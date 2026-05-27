const db = require('../config/db');

/**
 * POST /api/reports/compile/:classId
 * Homeroom teacher triggers compilation of class results
 */
const compileClassResults = async (req, res) => {
  try {
    const classId = Number(req.params.classId);

    // Permission: Only homeroom teacher for this class
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only homeroom teachers can compile class results' });
    }
    const { rows: [teacher] } = await db.query(
      `SELECT id, is_homeroom, homeroom_grade, homeroom_section
       FROM teachers
       WHERE user_id = $1`,
      [req.user.id]
    );
    if (!teacher || !teacher.is_homeroom) {
      return res.status(403).json({ error: 'Only homeroom teachers can compile class results' });
    }
    const { rows: [allowedClass] } = await db.query(
      `SELECT id FROM classes WHERE id = $1 AND grade = $2 AND section = $3`,
      [classId, teacher.homeroom_grade, teacher.homeroom_section]
    );
    if (!allowedClass) {
      return res.status(403).json({ error: 'You can only compile results for your homeroom section' });
    }

    // Check if all marks are submitted
    const { rows: [counts] } = await db.query(`
      WITH
      s AS (
        SELECT COUNT(*)::int AS student_count
        FROM enrollments
        WHERE class_id = $1
      ),
      sub AS (
        SELECT COUNT(DISTINCT subject_id)::int AS subject_count
        FROM teacher_assignments
        WHERE class_id = $1
      ),
      m AS (
        SELECT COUNT(DISTINCT (m.student_id, m.subject_id))::int AS mark_count
        FROM marks m
        JOIN enrollments e ON e.student_id = m.student_id
        WHERE e.class_id = $1
          AND m.subject_id IN (
            SELECT DISTINCT subject_id FROM teacher_assignments WHERE class_id = $1
          )
      )
      SELECT
        s.student_count,
        sub.subject_count,
        m.mark_count,
        (s.student_count * sub.subject_count) AS expected_count
      FROM s, sub, m
    `, [classId]);

    const expectedCount = Number(counts?.expected_count || 0);
    const markCount = Number(counts?.mark_count || 0);
    if (expectedCount > 0 && markCount < expectedCount) {
      return res.status(409).json({
        error: 'Compilation is not ready yet. All subject marks must be submitted first.',
        progress: {
          submitted: markCount,
          expected: expectedCount,
          missing: expectedCount - markCount,
        },
      });
    }

    // Return compiled results (same as classReport)
    const { rows } = await db.query(`
      SELECT
        ss.*,
        RANK() OVER (
          PARTITION BY ss.grade, ss.section, ss.academic_year
          ORDER BY ss.average DESC NULLS LAST
        ) AS rank,
        CASE
          WHEN ss.average >= 90 THEN 'A'
          WHEN ss.average >= 80 THEN 'B'
          WHEN ss.average >= 70 THEN 'C'
          WHEN ss.average >= 60 THEN 'D'
          ELSE 'F'
        END AS overall_grade
      FROM student_summary ss
      JOIN enrollments e ON e.student_id = ss.student_id
      WHERE e.class_id = $1
      ORDER BY ss.average DESC NULLS LAST
    `, [classId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * GET /api/reports/student/:studentId
 * Full report card: subject marks + summary (avg, rank, pass/fail)
 */
const studentReport = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Authorization: student can only see own report
    if (req.user.role === 'student') {
      const { rows: [st] } = await db.query('SELECT id FROM students WHERE user_id=$1', [req.user.id]);
      if (!st || st.id !== Number(studentId)) return res.status(403).json({ error: 'Forbidden' });
    }

    // Per-subject results — includes ALL enrolled subjects, even if marks not entered yet
    const { rows: subjects } = await db.query(`
      SELECT
        sub.id                                                    AS subject_id,
        sub.name                                                  AS subject_name,
        sub.pass_mark                                             AS pass_mark,
        COALESCE(m.assignment, 0)                                 AS assignment,
        COALESCE(m.mid, 0)                                        AS mid,
        COALESCE(m.final, 0)                                      AS final,
        m.total,
        CASE
          WHEN m.total IS NULL   THEN 'PENDING'
          WHEN m.total >= sub.pass_mark THEN 'PASS'
          ELSE                        'FAIL'
        END                                                       AS status
      FROM enrollments e
      JOIN teacher_assignments ta ON ta.class_id = e.class_id
      JOIN subjects sub            ON sub.id = ta.subject_id
      LEFT JOIN marks m            ON m.student_id = e.student_id
                                  AND m.subject_id  = sub.id
      WHERE e.student_id = $1
      GROUP BY sub.id, sub.name, sub.pass_mark, m.assignment, m.mid, m.final, m.total
      ORDER BY sub.name
    `, [studentId]);

    // Summary (avg, rank, pass/fail)
    const { rows: [summary] } = await db.query(`
      SELECT * FROM student_summary WHERE student_id = $1
    `, [studentId]);

    res.json({ subjects, summary: summary || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/class/:classId
 * Class-wide report ranked by average (admin / teacher)
 */
const classReport = async (req, res) => {
  try {
    const classId = Number(req.params.classId);

    // Teachers can only compile/view reports for their own homeroom section.
    if (req.user.role === 'teacher') {
      const { rows: [teacher] } = await db.query(
        `SELECT id, is_homeroom, homeroom_grade, homeroom_section
         FROM teachers
         WHERE user_id = $1`,
        [req.user.id]
      );

      if (!teacher || !teacher.is_homeroom) {
        return res.status(403).json({ error: 'Only homeroom teachers can compile class results' });
      }

      const { rows: [allowedClass] } = await db.query(
        `SELECT id FROM classes WHERE id = $1 AND grade = $2 AND section = $3`,
        [classId, teacher.homeroom_grade, teacher.homeroom_section]
      );

      if (!allowedClass) {
        return res.status(403).json({ error: 'You can only view compiled results for your homeroom section' });
      }
    }

    // Compile only after all subject marks are submitted for all students in class.
    const { rows: [counts] } = await db.query(`
      WITH
      s AS (
        SELECT COUNT(*)::int AS student_count
        FROM enrollments
        WHERE class_id = $1
      ),
      sub AS (
        SELECT COUNT(DISTINCT subject_id)::int AS subject_count
        FROM teacher_assignments
        WHERE class_id = $1
      ),
      m AS (
        SELECT COUNT(DISTINCT (m.student_id, m.subject_id))::int AS mark_count
        FROM marks m
        JOIN enrollments e ON e.student_id = m.student_id
        WHERE e.class_id = $1
          AND m.subject_id IN (
            SELECT DISTINCT subject_id FROM teacher_assignments WHERE class_id = $1
          )
      )
      SELECT
        s.student_count,
        sub.subject_count,
        m.mark_count,
        (s.student_count * sub.subject_count) AS expected_count
      FROM s, sub, m
    `, [classId]);

    const expectedCount = Number(counts?.expected_count || 0);
    const markCount = Number(counts?.mark_count || 0);

    if (expectedCount > 0 && markCount < expectedCount) {
      return res.status(409).json({
        error: 'Compilation is not ready yet. All subject marks must be submitted first.',
        progress: {
          submitted: markCount,
          expected: expectedCount,
          missing: expectedCount - markCount,
        },
      });
    }

    const { rows } = await db.query(`
      SELECT
        ss.*,
        RANK() OVER (
          PARTITION BY ss.grade, ss.section, ss.academic_year
          ORDER BY ss.average DESC NULLS LAST
        ) AS rank,
        CASE
          WHEN ss.average >= 90 THEN 'A'
          WHEN ss.average >= 80 THEN 'B'
          WHEN ss.average >= 70 THEN 'C'
          WHEN ss.average >= 60 THEN 'D'
          ELSE 'F'
        END AS overall_grade
      FROM student_summary ss
      JOIN enrollments e ON e.student_id = ss.student_id
      WHERE e.class_id = $1
      ORDER BY ss.average DESC NULLS LAST
    `, [classId]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/overview
 * Admin: high-level counts
 */
const overview = async (req, res) => {
  try {
    const [students, teachers, subjects, classes, marks] = await Promise.all([
      db.query('SELECT COUNT(*) FROM students'),
      db.query('SELECT COUNT(*) FROM teachers'),
      db.query('SELECT COUNT(*) FROM subjects'),
      db.query('SELECT COUNT(*) FROM classes'),
      db.query('SELECT COUNT(*) FROM marks'),
    ]);

    const passQuery = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE overall_status='PASS') AS pass_count,
        COUNT(*) FILTER (WHERE overall_status='FAIL') AS fail_count
      FROM student_summary
    `);

    res.json({
      totalStudents:  Number(students.rows[0].count),
      totalTeachers:  Number(teachers.rows[0].count),
      totalSubjects:  Number(subjects.rows[0].count),
      totalClasses:   Number(classes.rows[0].count),
      totalMarks:     Number(marks.rows[0].count),
      passCount:      Number(passQuery.rows[0].pass_count),
      failCount:      Number(passQuery.rows[0].fail_count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/reports/all-students
 * Admin: summary for all students
 */
const allStudentsSummary = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM student_summary ORDER BY grade, section, average DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { studentReport, classReport, overview, allStudentsSummary, compileClassResults };
