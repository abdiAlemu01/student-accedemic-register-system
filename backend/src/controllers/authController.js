const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

/**
 * POST /api/auth/login
 * Public route – returns signed JWT containing { id, email, role }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, email, password, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const payload = { id: user.id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    // Fetch role-specific profile name
    let profileName = user.email;
    if (user.role === 'student') {
      const { rows: sr } = await db.query(
        'SELECT name FROM students WHERE user_id = $1', [user.id]
      );
      if (sr.length) profileName = sr[0].name;
    } else if (user.role === 'teacher') {
      const { rows: tr } = await db.query(
        'SELECT name FROM teachers WHERE user_id = $1', [user.id]
      );
      if (tr.length) profileName = tr[0].name;
    } else {
      profileName = 'Administrator';
    }

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: profileName },
    });
  } catch (err) {
    console.error('login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/auth/me
 * Returns logged-in user profile.
 */
const getMe = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const user = rows[0];
    let name = user.email;

    if (user.role === 'student') {
      const { rows: sr } = await db.query('SELECT name FROM students WHERE user_id=$1', [user.id]);
      if (sr.length) name = sr[0].name;
    } else if (user.role === 'teacher') {
      const { rows: tr } = await db.query('SELECT name FROM teachers WHERE user_id=$1', [user.id]);
      if (tr.length) name = tr[0].name;
    } else {
      name = 'Administrator';
    }

    res.json({ id: user.id, email: user.email, role: user.role, name });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * POST /api/auth/register
 * Public – creates a new user and returns a JWT.
 */
const register = async (req, res) => {
  const {
    email, password, role, name,
    // student fields
    gender, grade, section, academic_year, semester,
    // teacher field
    department,
  } = req.body;

  const allowedRoles = ['student', 'teacher', 'admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be student, teacher, or admin' });
  }

  if ((role === 'student' || role === 'teacher') && !name) {
    return res.status(400).json({ error: 'Full name is required' });
  }

  if (role === 'student' && (!grade || !section)) {
    return res.status(400).json({ error: 'Grade and section are required' });
  }

  const client = await db.getClient();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const hashed = await bcrypt.hash(password, 10);

    const { rows: [user] } = await client.query(
      `INSERT INTO users (email, password, role) VALUES ($1,$2,$3) RETURNING id, email, role`,
      [email.toLowerCase().trim(), hashed, role]
    );

    let profileName = name;
    let studentId = null;

    if (role === 'student') {
      const { rows: [student] } = await client.query(
        `INSERT INTO students (user_id, name, gender, grade, section, academic_year, semester)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [user.id, name, gender || 'male', grade, section, academic_year || '2024/25', semester || 'Semester 1']
      );
      studentId = student.id;

      // Auto-enroll the student into the matching class (by grade/section/academic_year)
      try {
        const targetYear = academic_year || '2024/25';
        let classRow = null;

        const { rows: exactClass } = await client.query(
          `SELECT id FROM classes WHERE grade=$1 AND section=$2 AND academic_year=$3 LIMIT 1`,
          [grade, section, targetYear]
        );
        if (exactClass.length) classRow = exactClass[0];

        if (!classRow) {
          const { rows: fallbackClass } = await client.query(
            `SELECT id FROM classes WHERE grade=$1 AND section=$2 ORDER BY academic_year DESC, id DESC LIMIT 1`,
            [grade, section]
          );
          if (fallbackClass.length) classRow = fallbackClass[0];
        }

        if (classRow) {
          await client.query(
            `INSERT INTO enrollments (student_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [studentId, classRow.id]
          );
        }
      } catch (enrollErr) {
        console.warn('register auto-enroll skipped:', enrollErr.message);
      }
    } else if (role === 'teacher') {
      await client.query(
        `INSERT INTO teachers (user_id, name, department)
         VALUES ($1,$2,$3) RETURNING id`,
        [user.id, name, department || null]
      );
    } else {
      profileName = 'Administrator';
    }

    await client.query('COMMIT');
    transactionOpen = false;

    // Auto-enroll is best-effort for students only.
    if (role === 'student' && studentId) {
      try {
        const TARGET_SUBJECTS = ['Biology', 'Chemistry', 'English', 'Physics', 'Mathematics'];
        const { rows: tableChecks } = await db.query(`
          SELECT
            to_regclass('public.classes') AS classes,
            to_regclass('public.teacher_assignments') AS teacher_assignments,
            to_regclass('public.subjects') AS subjects,
            to_regclass('public.enrollments') AS enrollments
        `);

        const tablesReady =
          tableChecks[0]?.classes &&
          tableChecks[0]?.teacher_assignments &&
          tableChecks[0]?.subjects &&
          tableChecks[0]?.enrollments;
        if (tablesReady) {
          const { rows: classRows } = await db.query(
            `SELECT DISTINCT ta.class_id
             FROM teacher_assignments ta
             JOIN subjects sub ON ta.subject_id = sub.id
             WHERE sub.name = ANY($1::text[])`,
            [TARGET_SUBJECTS]
          );

          for (const { class_id } of classRows) {
            await db.query(
              `INSERT INTO enrollments (student_id, class_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [studentId, class_id]
            );
          }
        }
      } catch (enrollErr) {
        console.warn('register auto-enroll skipped:', enrollErr.message);
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: profileName },
    });
  } catch (err) {
    if (transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('register rollback error:', rollbackErr.message);
      }
    }
    if (err.code === '23505') return res.status(409).json({ error: 'Email is already registered' });
    console.error('register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { login, getMe, register };
