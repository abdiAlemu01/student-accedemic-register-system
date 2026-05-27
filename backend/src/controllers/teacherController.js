const bcrypt = require('bcryptjs');
const db     = require('../config/db');

/** GET /api/teachers */
const getAllTeachers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        t.*,
        u.email,
        sub.name AS subject_name
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      ORDER BY t.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/teachers/:id */
const getTeacherById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        t.*,
        u.email,
        sub.name AS subject_name
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/teachers/me/assignments  – Teacher: own assigned classes */
const getMyAssignments = async (req, res) => {
  try {
    const { rows: [teacher] } = await db.query(
      'SELECT id FROM teachers WHERE user_id=$1', [req.user.id]
    );
    if (!teacher) return res.status(404).json({ error: 'Teacher profile not found' });

    const { rows } = await db.query(`
      SELECT
        ta.id            AS assignment_id,
        c.id             AS class_id,
        c.grade,
        c.section,
        c.academic_year,
        sub.id           AS subject_id,
        sub.name         AS subject_name
      FROM teacher_assignments ta
      JOIN classes c  ON ta.class_id  = c.id
      JOIN subjects sub ON ta.subject_id = sub.id
      WHERE ta.teacher_id = $1
      ORDER BY c.grade, c.section, sub.name
    `, [teacher.id]);

    // Include homeroom class as an automatic assignment so teachers can see their section students
    const { rows: [homeroomTeacher] } = await db.query(`
      SELECT id, subject_id, is_homeroom, homeroom_grade, homeroom_section
      FROM teachers
      WHERE id = $1
    `, [teacher.id]);

    if (homeroomTeacher?.is_homeroom && homeroomTeacher.homeroom_grade && homeroomTeacher.homeroom_section) {
      const { rows: [homeroomClass] } = await db.query(`
        SELECT id, grade, section, academic_year
        FROM classes
        WHERE grade = $1 AND section = $2
        ORDER BY academic_year DESC, id DESC
        LIMIT 1
      `, [homeroomTeacher.homeroom_grade, homeroomTeacher.homeroom_section]);

      if (homeroomClass && !rows.some((row) => String(row.class_id) === String(homeroomClass.id))) {
        const subjectId = homeroomTeacher.subject_id || null;
        let subjectName = null;

        if (subjectId) {
          const { rows: [sub] } = await db.query(
            'SELECT id, name FROM subjects WHERE id=$1',
            [subjectId]
          );
          subjectName = sub?.name || null;
        }

        rows.unshift({
          assignment_id: `homeroom-${teacher.id}-${homeroomClass.id}`,
          class_id: homeroomClass.id,
          grade: homeroomClass.grade,
          section: homeroomClass.section,
          academic_year: homeroomClass.academic_year,
          subject_id: subjectId,
          subject_name: subjectName || 'Homeroom Section',
        });
      }
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/teachers  – Admin only */
const createTeacher = async (req, res) => {
  try {
    const {
      email,
      password,
      name,
      department,
      subject_id,
      is_homeroom = false,
      homeroom_grade = null,
      homeroom_section = null,
    } = req.body;

    if (!subject_id) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (is_homeroom && (!homeroom_grade || !homeroom_section)) {
      return res.status(400).json({ error: 'Grade and section are required for homeroom teachers' });
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const hashed = await bcrypt.hash(password, 10);

      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password, role) VALUES ($1,$2,'teacher') RETURNING id`,
        [email.toLowerCase().trim(), hashed]
      );

      const { rows: [teacher] } = await client.query(
        `INSERT INTO teachers (user_id, name, department, subject_id, is_homeroom, homeroom_grade, homeroom_section)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [user.id, name, department || null, subject_id, Boolean(is_homeroom), is_homeroom ? homeroom_grade : null, is_homeroom ? homeroom_section : null]
      );

      const { rows: [result] } = await client.query(`
        SELECT t.*, u.email, sub.name AS subject_name
        FROM teachers t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN subjects sub ON t.subject_id = sub.id
        WHERE t.id = $1
      `, [teacher.id]);

      await client.query('COMMIT');
      res.status(201).json(result || { ...teacher, email, subject_name: null });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  }
};

/** PUT /api/teachers/:id  – Admin only */
const updateTeacher = async (req, res) => {
  try {
    const {
      name,
      department,
      email,
      subject_id,
      is_homeroom = false,
      homeroom_grade = null,
      homeroom_section = null,
    } = req.body;
    const { rows: existing } = await db.query('SELECT * FROM teachers WHERE id=$1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Teacher not found' });

    if (is_homeroom && (!homeroom_grade || !homeroom_section)) {
      return res.status(400).json({ error: 'Grade and section are required for homeroom teachers' });
    }

    const { rows: [teacher] } = await db.query(
      `UPDATE teachers
       SET name=$1, department=$2, subject_id=$3, is_homeroom=$4, homeroom_grade=$5, homeroom_section=$6
       WHERE id=$7 RETURNING *`,
      [
        name,
        department || null,
        subject_id || null,
        Boolean(is_homeroom),
        is_homeroom ? homeroom_grade : null,
        is_homeroom ? homeroom_section : null,
        req.params.id,
      ]
    );

    if (email) {
      await db.query('UPDATE users SET email=$1 WHERE id=$2',
        [email.toLowerCase().trim(), existing[0].user_id]);
    }

    const { rows: [result] } = await db.query(`
      SELECT t.*, u.email, sub.name AS subject_name
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN subjects sub ON t.subject_id = sub.id
      WHERE t.id = $1
    `, [teacher.id]);

    res.json(result || teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/teachers/:id  – Admin only */
const deleteTeacher = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM teachers WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found' });
    await db.query('DELETE FROM users WHERE id=$1', [rows[0].user_id]);
    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllTeachers,
  getTeacherById,
  getMyAssignments,
  createTeacher,
  updateTeacher,
  deleteTeacher,
};
