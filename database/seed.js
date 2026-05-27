/**
 * Seed script – run ONCE after schema.sql to create demo accounts.
 * Usage:  node database/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'sarms_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const hash = (pw) => bcrypt.hash(pw, 10);

    // ── Users ────────────────────────────────────────────────────────────────
    const adminHash   = await hash('Admin@123');
    const teacherHash = await hash('Teacher@123');
    const studentHash = await hash('Student@123');

    const { rows: [admin] } = await client.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1,$2,'admin') ON CONFLICT (email) DO UPDATE SET role='admin' RETURNING id`,
      ['admin@sarms.edu', adminHash]
    );

    const { rows: [t1User] } = await client.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1,$2,'teacher') ON CONFLICT (email) DO UPDATE SET role='teacher' RETURNING id`,
      ['teacher1@sarms.edu', teacherHash]
    );

    const { rows: [s1User] } = await client.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1,$2,'student') ON CONFLICT (email) DO UPDATE SET role='student' RETURNING id`,
      ['student1@sarms.edu', studentHash]
    );

    const { rows: [s2User] } = await client.query(
      `INSERT INTO users (email, password, role)
       VALUES ($1,$2,'student') ON CONFLICT (email) DO UPDATE SET role='student' RETURNING id`,
      ['student2@sarms.edu', studentHash]
    );

    // ── Teacher ───────────────────────────────────────────────────────────────
    const { rows: [teacher] } = await client.query(
      `INSERT INTO teachers (user_id, name, department)
       VALUES ($1,'Abebe Girma','Mathematics') ON CONFLICT (user_id) DO UPDATE SET name='Abebe Girma' RETURNING id`,
      [t1User.id]
    );

    // ── Students ──────────────────────────────────────────────────────────────
    const { rows: [st1] } = await client.query(
      `INSERT INTO students (user_id,name,gender,grade,section,academic_year,semester)
       VALUES ($1,'Kaleb Tesfaye','male','10','A','2024/25','Semester 1')
       ON CONFLICT (user_id) DO UPDATE SET name='Kaleb Tesfaye' RETURNING id`,
      [s1User.id]
    );

    const { rows: [st2] } = await client.query(
      `INSERT INTO students (user_id,name,gender,grade,section,academic_year,semester)
       VALUES ($1,'Hana Bekele','female','10','A','2024/25','Semester 1')
       ON CONFLICT (user_id) DO UPDATE SET name='Hana Bekele' RETURNING id`,
      [s2User.id]
    );

    // ── Subjects ──────────────────────────────────────────────────────────────
    const subjects = ['Mathematics', 'Physics', 'English', 'Biology', 'Chemistry'];
    const subjectIds = [];
    for (const name of subjects) {
      const { rows: [sub] } = await client.query(
        `INSERT INTO subjects (name, total_mark)
         VALUES ($1, 100)
         ON CONFLICT DO NOTHING RETURNING id`,
        [name]
      );
      if (sub) subjectIds.push(sub.id);
      else {
        const { rows: [existing] } = await client.query(`SELECT id FROM subjects WHERE name=$1`, [name]);
        subjectIds.push(existing.id);
      }
    }

    // ── Class ─────────────────────────────────────────────────────────────────
    const { rows: [cls] } = await client.query(
      `INSERT INTO classes (grade, section, academic_year)
       VALUES ('10','A','2024/25')
       ON CONFLICT (grade, section, academic_year) DO UPDATE SET grade='10' RETURNING id`
    );

    // ── Teacher assignments ───────────────────────────────────────────────────
    for (const sid of subjectIds) {
      await client.query(
        `INSERT INTO teacher_assignments (teacher_id, subject_id, class_id)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [teacher.id, sid, cls.id]
      );
    }

    // ── Enrollments ───────────────────────────────────────────────────────────
    for (const stId of [st1.id, st2.id]) {
      await client.query(
        `INSERT INTO enrollments (student_id, class_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [stId, cls.id]
      );
    }

    // ── Sample marks ─────────────────────────────────────────────────────────
    const sampleMarks = [
      [st1.id, subjectIds[0], teacher.id, 25, 26, 38],
      [st1.id, subjectIds[1], teacher.id, 22, 24, 35],
      [st1.id, subjectIds[2], teacher.id, 28, 27, 39],
      [st1.id, subjectIds[3], teacher.id, 20, 22, 30],
      [st1.id, subjectIds[4], teacher.id, 27, 25, 37],
      [st2.id, subjectIds[0], teacher.id, 18, 20, 28],
      [st2.id, subjectIds[1], teacher.id, 24, 25, 36],
      [st2.id, subjectIds[2], teacher.id, 26, 28, 38],
      [st2.id, subjectIds[3], teacher.id, 15, 18, 22],
      [st2.id, subjectIds[4], teacher.id, 22, 23, 32],
    ];

    for (const [sid, subId, tid, asgn, mid, fin] of sampleMarks) {
      await client.query(
        `INSERT INTO marks (student_id, subject_id, teacher_id, assignment, mid, final)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (student_id, subject_id) DO NOTHING`,
        [sid, subId, tid, asgn, mid, fin]
      );
    }

    await client.query('COMMIT');
    console.log('✅  Seed complete!');
    console.log('\nDemo credentials:');
    console.log('  Admin:   admin@sarms.edu    / Admin@123');
    console.log('  Teacher: teacher1@sarms.edu / Teacher@123');
    console.log('  Student: student1@sarms.edu / Student@123');
    console.log('  Student: student2@sarms.edu / Student@123');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
