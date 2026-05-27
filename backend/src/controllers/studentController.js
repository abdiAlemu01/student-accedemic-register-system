const bcrypt = require('bcryptjs');
const db     = require('../config/db');

const findBestMatchingClass = async (client, { grade, section, academic_year }) => {
  const { rows: exact } = await client.query(
    `SELECT id, grade, section, academic_year
     FROM classes
     WHERE grade = $1 AND section = $2 AND academic_year = $3
     ORDER BY id DESC
     LIMIT 1`,
    [grade, section, academic_year]
  );
  if (exact.length) return exact[0];

  const { rows: fallback } = await client.query(
    `SELECT id, grade, section, academic_year
     FROM classes
     WHERE grade = $1 AND section = $2
     ORDER BY academic_year DESC, id DESC
     LIMIT 1`,
    [grade, section]
  );
  return fallback[0] || null;
};

/** GET /api/students  – Admin: all students | Student: own record */
const getAllStudents = async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      ({ rows } = await db.query(`
        SELECT s.*, u.email
        FROM students s
        JOIN users u ON s.user_id = u.id
        ORDER BY s.name
      `));
    } else {
      ({ rows } = await db.query(`
        SELECT s.*, u.email
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = $1
      `, [req.user.id]));
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/students/:id */
const getStudentById = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Student not found' });

    // Students can only view their own record
    if (req.user.role === 'student') {
      const mine = await db.query('SELECT id FROM students WHERE user_id=$1', [req.user.id]);
      if (!mine.rows.length || mine.rows[0].id !== rows[0].id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/students  – Admin only */
const createStudent = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { email, password, name, gender, grade, section, academic_year, semester } = req.body;

    const hashed = await bcrypt.hash(password, 10);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password, role) VALUES ($1,$2,'student') RETURNING id`,
      [email.toLowerCase().trim(), hashed]
    );

    const { rows: [student] } = await client.query(`
      INSERT INTO students (user_id, name, gender, grade, section, academic_year, semester)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [user.id, name, gender, grade, section, academic_year, semester]);

    const matchedClass = await findBestMatchingClass(client, {
      grade,
      section,
      academic_year,
    });

    if (matchedClass) {
      await client.query(
        `INSERT INTO enrollments (student_id, class_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [student.id, matchedClass.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      ...student,
      email,
      auto_enrolled_class_id: matchedClass?.id || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/** PUT /api/students/:id  – Admin only */
const updateStudent = async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { name, gender, grade, section, academic_year, semester, email } = req.body;
    const { id } = req.params;

    const { rows: existing } = await client.query('SELECT * FROM students WHERE id=$1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Student not found' });

    const { rows: [student] } = await client.query(`
      UPDATE students SET name=$1, gender=$2, grade=$3, section=$4,
        academic_year=$5, semester=$6
      WHERE id=$7 RETURNING *
    `, [name, gender, grade, section, academic_year, semester, id]);

    const matchedClass = await findBestMatchingClass(client, {
      grade,
      section,
      academic_year,
    });

    if (matchedClass) {
      // Keep enrollment aligned with student's current section
      await client.query('DELETE FROM enrollments WHERE student_id = $1', [id]);
      await client.query(
        `INSERT INTO enrollments (student_id, class_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, matchedClass.id]
      );
    }

    if (email) {
      await client.query(
        'UPDATE users SET email=$1 WHERE id=$2',
        [email.toLowerCase().trim(), existing[0].user_id]
      );
    }

    await client.query('COMMIT');
    res.json({
      ...student,
      auto_enrolled_class_id: matchedClass?.id || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/** DELETE /api/students/:id  – Admin only (cascades to user) */
const deleteStudent = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT user_id FROM students WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });

    await db.query('DELETE FROM users WHERE id=$1', [rows[0].user_id]);
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllStudents, getStudentById, createStudent, updateStudent, deleteStudent };
