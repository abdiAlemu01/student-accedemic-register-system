const db = require('../config/db');

/** GET /api/classes */
const getAllClasses = async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM classes ORDER BY grade, section');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/classes */
const createClass = async (req, res) => {
  try {
    const { grade, section, academic_year } = req.body;
    const { rows: [cls] } = await db.query(
      `INSERT INTO classes (grade, section, academic_year)
       VALUES ($1,$2,$3) RETURNING *`,
      [grade, section, academic_year || '2024/25']
    );
    res.status(201).json(cls);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Class already exists' });
    res.status(500).json({ error: err.message });
  }
};

/** PUT /api/classes/:id */
const updateClass = async (req, res) => {
  try {
    const { grade, section, academic_year } = req.body;
    const { rows } = await db.query(
      `UPDATE classes
       SET grade=$1, section=$2, academic_year=$3
       WHERE id=$4
       RETURNING *`,
      [grade, section, academic_year || '2024/25', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Class not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Class already exists' });
    res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/classes/:id */
const deleteClass = async (req, res) => {
  try {
    const { rows } = await db.query('DELETE FROM classes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Class not found' });
    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/classes/:id/students  – Students enrolled in a class */
const getClassStudents = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.name, s.gender, s.grade, s.section, s.academic_year, s.semester, u.email
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN users u    ON s.user_id = u.id
      WHERE e.class_id = $1
      ORDER BY s.name
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/classes/:id/enroll  – Enroll a student */
const enrollStudent = async (req, res) => {
  try {
    const { student_id } = req.body;
    await db.query(
      'INSERT INTO enrollments (student_id, class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [student_id, req.params.id]
    );
    res.status(201).json({ message: 'Student enrolled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/classes/:id/enroll/:studentId */
const unenrollStudent = async (req, res) => {
  try {
    await db.query(
      'DELETE FROM enrollments WHERE class_id=$1 AND student_id=$2',
      [req.params.id, req.params.studentId]
    );
    res.json({ message: 'Student unenrolled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/classes/:id/assignments  – Teacher assignments for a class */
const getClassAssignments = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ta.id, t.name AS teacher_name, sub.name AS subject_name,
             ta.teacher_id, ta.subject_id, ta.submitted
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN subjects sub ON ta.subject_id = sub.id
      WHERE ta.class_id = $1
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/classes/:id/assignments  – Assign a teacher to subject in class */
const assignTeacher = async (req, res) => {
  try {
    const { teacher_id, subject_id } = req.body;
    const { rows: [ta] } = await db.query(`
      INSERT INTO teacher_assignments (teacher_id, subject_id, class_id)
      VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [teacher_id, subject_id, req.params.id]);
    res.status(201).json(ta || { message: 'Assignment already exists' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** DELETE /api/classes/assignments/:assignmentId */
const removeAssignment = async (req, res) => {
  try {
    await db.query('DELETE FROM teacher_assignments WHERE id=$1', [req.params.assignmentId]);
    res.json({ message: 'Assignment removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllClasses,
  createClass,
  updateClass,
  deleteClass,
  getClassStudents,
  enrollStudent,
  unenrollStudent,
  getClassAssignments,
  assignTeacher,
  removeAssignment,
};
