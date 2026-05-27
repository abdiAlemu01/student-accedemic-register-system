const db = require('../config/db');

let hasSemesterColumnCache = null;

const hasSemesterColumn = async () => {
  if (hasSemesterColumnCache !== null) return hasSemesterColumnCache;
  const { rows: [info] } = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'marks'
        AND column_name = 'semester'
    ) AS has_semester
  `);
  hasSemesterColumnCache = Boolean(info?.has_semester);
  return hasSemesterColumnCache;
};

/**
 * GET /api/marks
 * Admin: all marks
 * Teacher: marks they entered
 * Student: own marks
 */
const getAllMarks = async (req, res) => {
  try {
    let sql = `
      SELECT m.*, s.name AS student_name, sub.name AS subject_name
      FROM marks m
      JOIN students s   ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id  = sub.id
    `;
    const params = [];

    if (req.user.role === 'teacher') {
      const { rows: [t] } = await db.query('SELECT id FROM teachers WHERE user_id=$1', [req.user.id]);
      if (!t) return res.status(404).json({ error: 'Teacher not found' });
      sql += ' WHERE m.teacher_id = $1';
      params.push(t.id);
    } else if (req.user.role === 'student') {
      const { rows: [st] } = await db.query('SELECT id FROM students WHERE user_id=$1', [req.user.id]);
      if (!st) return res.status(404).json({ error: 'Student not found' });
      sql += ' WHERE m.student_id = $1';
      params.push(st.id);
    }

    sql += ' ORDER BY s.name, sub.name';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/marks/student/:studentId
 * Per-student marks (admin or the student themselves)
 */
const getMarksByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Students can only see own marks
    if (req.user.role === 'student') {
      const { rows: [st] } = await db.query('SELECT id FROM students WHERE user_id=$1', [req.user.id]);
      if (!st || st.id !== Number(studentId)) return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await db.query(`
      SELECT m.*, sub.name AS subject_name, t.name AS teacher_name
      FROM marks m
      JOIN subjects sub ON m.subject_id = sub.id
      LEFT JOIN teachers t ON m.teacher_id = t.id
      WHERE m.student_id = $1
      ORDER BY sub.name
    `, [studentId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/marks  – Teacher / Admin
 * Single mark entry
 */
const createMark = async (req, res) => {
  try {
    const { student_id, subject_id, assignment, mid, final, semester = 'Semester 1' } = req.body;

    let teacher_id = null;
    if (req.user.role === 'teacher') {
      const { rows: [t] } = await db.query('SELECT id, is_homeroom, homeroom_grade, homeroom_section FROM teachers WHERE user_id=$1', [req.user.id]);
      if (!t) return res.status(404).json({ error: 'Teacher profile not found' });
      teacher_id = t.id;
      // Determine if this teacher is homeroom for the student's class
      const { rows: [student] } = await db.query('SELECT grade, section FROM students WHERE id=$1', [student_id]);
      let status = 'submitted';
      if (t.is_homeroom && student && t.homeroom_grade === student.grade && t.homeroom_section === student.section) {
        status = 'compiled'; // Homeroom teacher can directly compile
      }
      const supportsSemester = await hasSemesterColumn();
      const { rows: [mark] } = supportsSemester
        ? await db.query(`
            INSERT INTO marks (student_id, subject_id, teacher_id, semester, assignment, mid, final, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (student_id, subject_id, semester)
            DO UPDATE SET assignment=$5, mid=$6, final=$7, status=$8, updated_at=NOW()
            RETURNING *
          `, [student_id, subject_id, teacher_id, semester, assignment, mid, final, status])
        : await db.query(`
            INSERT INTO marks (student_id, subject_id, teacher_id, assignment, mid, final, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (student_id, subject_id)
            DO UPDATE SET assignment=$4, mid=$5, final=$6, status=$7, updated_at=NOW()
            RETURNING *
          `, [student_id, subject_id, teacher_id, assignment, mid, final, status]);
      return res.status(201).json(mark);
    } else if (req.body.teacher_id) {
      teacher_id = req.body.teacher_id;
    }

    // Default for admin or other
    const supportsSemester = await hasSemesterColumn();
    const { rows: [mark] } = supportsSemester
      ? await db.query(`
          INSERT INTO marks (student_id, subject_id, teacher_id, semester, assignment, mid, final, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'compiled')
          ON CONFLICT (student_id, subject_id, semester)
          DO UPDATE SET assignment=$5, mid=$6, final=$7, status='compiled', updated_at=NOW()
          RETURNING *
        `, [student_id, subject_id, teacher_id, semester, assignment, mid, final])
      : await db.query(`
          INSERT INTO marks (student_id, subject_id, teacher_id, assignment, mid, final, status)
          VALUES ($1,$2,$3,$4,$5,$6,'compiled')
          ON CONFLICT (student_id, subject_id)
          DO UPDATE SET assignment=$4, mid=$5, final=$6, status='compiled', updated_at=NOW()
          RETURNING *
        `, [student_id, subject_id, teacher_id, assignment, mid, final]);
    res.status(201).json(mark);
  } catch (err) {
    if (err.code === '23514') return res.status(400).json({ error: 'Mark value out of allowed range' });
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/marks/bulk  – Bulk mark entry for a class/subject
 */
const bulkCreateMarks = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { subject_id, semester = 'Semester 1', marks } = req.body; // marks: [{student_id, assignment, mid, final}]

    let teacher_id = null;
    let isHomeroom = false;
    let homeroomGrade = null;
    let homeroomSection = null;
    if (req.user.role === 'teacher') {
      const { rows: [t] } = await client.query('SELECT id, is_homeroom, homeroom_grade, homeroom_section FROM teachers WHERE user_id=$1', [req.user.id]);
      if (t) {
        teacher_id = t.id;
        isHomeroom = t.is_homeroom;
        homeroomGrade = t.homeroom_grade;
        homeroomSection = t.homeroom_section;
      }
    }

    const supportsSemester = await hasSemesterColumn();
    const results = [];
    for (const m of marks) {
      // Determine if this teacher is homeroom for the student's class
      const { rows: [student] } = await client.query('SELECT grade, section FROM students WHERE id=$1', [m.student_id]);
      let status = 'submitted';
      if (isHomeroom && student && homeroomGrade === student.grade && homeroomSection === student.section) {
        status = 'compiled';
      }
      const { rows: [mark] } = supportsSemester
        ? await client.query(`
            INSERT INTO marks (student_id, subject_id, teacher_id, semester, assignment, mid, final, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (student_id, subject_id, semester)
            DO UPDATE SET assignment=$5, mid=$6, final=$7, status=$8, updated_at=NOW()
            RETURNING *
          `, [m.student_id, subject_id, teacher_id, semester, m.assignment || 0, m.mid || 0, m.final || 0, status])
        : await client.query(`
            INSERT INTO marks (student_id, subject_id, teacher_id, assignment, mid, final, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (student_id, subject_id)
            DO UPDATE SET assignment=$4, mid=$5, final=$6, status=$7, updated_at=NOW()
            RETURNING *
          `, [m.student_id, subject_id, teacher_id, m.assignment || 0, m.mid || 0, m.final || 0, status]);
      results.push(mark);
    }

    await client.query('COMMIT');
    res.status(201).json({ saved: results.length, marks: results });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};
/**
 * GET /api/marks/class/:classId/submitted
 * Homeroom teacher: get all submitted marks for their class
 */
const getSubmittedMarksForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    // Only homeroom teacher for this class can access
    const { rows: [teacher] } = await db.query('SELECT id, is_homeroom, homeroom_grade, homeroom_section FROM teachers WHERE user_id=$1', [req.user.id]);
    if (!teacher || !teacher.is_homeroom) return res.status(403).json({ error: 'Not a homeroom teacher' });
    const { rows: [cls] } = await db.query('SELECT grade, section FROM classes WHERE id=$1', [classId]);
    if (!cls || teacher.homeroom_grade !== cls.grade || teacher.homeroom_section !== cls.section) return res.status(403).json({ error: 'Not homeroom for this class' });
    // Get all students in this class
    const { rows: students } = await db.query('SELECT id FROM students WHERE grade=$1 AND section=$2', [cls.grade, cls.section]);
    const studentIds = students.map(s => s.id);
    if (!studentIds.length) return res.json([]);
    // Get all submitted marks for these students
    const { rows: marks } = await db.query(`
      SELECT m.*, s.name AS student_name, sub.name AS subject_name, t.name AS teacher_name
      FROM marks m
      JOIN students s    ON m.student_id = s.id
      JOIN subjects sub  ON m.subject_id = sub.id
      LEFT JOIN teachers t ON m.teacher_id = t.id
      WHERE m.student_id = ANY($1) AND m.status = 'submitted'
      ORDER BY s.name, sub.name
    `, [studentIds]);
    res.json(marks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/marks/class/:classId/compile
 * Homeroom teacher: compile all submitted marks for their class
 */
const compileMarksForClass = async (req, res) => {
  try {
    const { classId } = req.params;
    // Only homeroom teacher for this class can access
    const { rows: [teacher] } = await db.query('SELECT id, is_homeroom, homeroom_grade, homeroom_section FROM teachers WHERE user_id=$1', [req.user.id]);
    if (!teacher || !teacher.is_homeroom) return res.status(403).json({ error: 'Not a homeroom teacher' });
    const { rows: [cls] } = await db.query('SELECT grade, section FROM classes WHERE id=$1', [classId]);
    if (!cls || teacher.homeroom_grade !== cls.grade || teacher.homeroom_section !== cls.section) return res.status(403).json({ error: 'Not homeroom for this class' });
    // Get all students in this class
    const { rows: students } = await db.query('SELECT id FROM students WHERE grade=$1 AND section=$2', [cls.grade, cls.section]);
    const studentIds = students.map(s => s.id);
    if (!studentIds.length) return res.json({ compiled: 0 });
    // Update all submitted marks to compiled
    const { rowCount } = await db.query(`
      UPDATE marks SET status='compiled', updated_at=NOW()
      WHERE student_id = ANY($1) AND status = 'submitted'
    `, [studentIds]);
    res.json({ compiled: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/marks/:id  – Teacher who created it or Admin
 */
const updateMark = async (req, res) => {
  try {
    const { assignment, mid, final } = req.body;
    const { rows: existing } = await db.query('SELECT * FROM marks WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Mark not found' });

    if (req.user.role === 'teacher') {
      const { rows: [t] } = await db.query('SELECT id FROM teachers WHERE user_id=$1', [req.user.id]);
      if (!t || t.id !== existing[0].teacher_id) return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows: [mark] } = await db.query(`
      UPDATE marks SET assignment=$1, mid=$2, final=$3, updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [assignment, mid, final, req.params.id]);

    res.json(mark);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/marks/:id  – Admin only */
const deleteMark = async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM marks WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Mark not found' });
    res.json({ message: 'Mark deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * POST /api/marks/submit
 * Subject teacher submits results for a class/subject/semester
 * Body: { class_id, subject_id }
 */
const submitResults = async (req, res) => {
  try {
    const { class_id, subject_id } = req.body;
    if (!class_id || !subject_id) return res.status(400).json({ error: 'class_id and subject_id required' });

    // Only subject teacher can submit
    let teacher_id = null;
    if (req.user.role === 'teacher') {
      const { rows: [t] } = await db.query('SELECT id FROM teachers WHERE user_id=$1', [req.user.id]);
      if (!t) return res.status(404).json({ error: 'Teacher not found' });
      teacher_id = t.id;
    } else if (req.body.teacher_id) {
      teacher_id = req.body.teacher_id;
    }
    if (!teacher_id) return res.status(403).json({ error: 'Forbidden' });

    // Update assignment
    const { rowCount } = await db.query(
      `UPDATE teacher_assignments SET submitted=TRUE
       WHERE teacher_id=$1 AND class_id=$2 AND subject_id=$3`,
      [teacher_id, class_id, subject_id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllMarks, getMarksByStudent, createMark, bulkCreateMarks, updateMark, deleteMark, submitResults, getSubmittedMarksForClass, compileMarksForClass };
