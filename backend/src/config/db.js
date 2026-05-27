const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'sarms_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max:      20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

/**
 * Run a parameterised query.
 * @param {string} text  – SQL string
 * @param {any[]}  params – bound parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Acquire a client for multi-statement transactions.
 */
const getClient = () => pool.connect();

/**
 * Ensure newer schema columns/views exist for older databases.
 * Also creates base tables if they don't exist (for fresh deployments).
 */
const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if base tables exist, if not create them
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tablesExist.rows[0].exists) {
      // Create base schema for fresh deployment
      console.log('Creating base database schema...');
      
      // Create departments table first (referenced by others)
      await client.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id          SERIAL PRIMARY KEY,
          name        VARCHAR(100) NOT NULL UNIQUE,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id          SERIAL PRIMARY KEY,
          email       VARCHAR(255) UNIQUE NOT NULL,
          password    VARCHAR(255) NOT NULL,
          role        VARCHAR(20)  NOT NULL CHECK (role IN ('admin','teacher','student')),
          created_at  TIMESTAMPTZ  DEFAULT NOW(),
          updated_at  TIMESTAMPTZ  DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS students (
          id              SERIAL PRIMARY KEY,
          user_id         INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name            VARCHAR(255) NOT NULL,
          gender          VARCHAR(10)  CHECK (gender IN ('male','female','other')),
          grade           VARCHAR(20)  NOT NULL,
          section         VARCHAR(10)  NOT NULL,
          academic_year   VARCHAR(20)  NOT NULL,
          semester        VARCHAR(20)  NOT NULL,
          created_at      TIMESTAMPTZ  DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS teachers (
          id          SERIAL PRIMARY KEY,
          user_id     INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name        VARCHAR(255) NOT NULL,
          department  INT REFERENCES departments(id) ON DELETE SET NULL,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS subjects (
          id          SERIAL PRIMARY KEY,
          name        VARCHAR(255) NOT NULL,
          department  INT REFERENCES departments(id) ON DELETE SET NULL,
          total_mark  INT NOT NULL DEFAULT 100 CHECK (total_mark > 0 AND total_mark <= 100),
          pass_mark   INT NOT NULL DEFAULT 50 CHECK (pass_mark >= 0 AND pass_mark <= total_mark),
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS classes (
          id            SERIAL PRIMARY KEY,
          grade         VARCHAR(20) NOT NULL,
          section       VARCHAR(10) NOT NULL,
          academic_year VARCHAR(20) NOT NULL DEFAULT '2024/25',
          UNIQUE (grade, section, academic_year)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS teacher_assignments (
          id          SERIAL PRIMARY KEY,
          teacher_id  INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
          subject_id  INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          class_id    INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          submitted   BOOLEAN NOT NULL DEFAULT FALSE,
          UNIQUE (teacher_id, subject_id, class_id)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS enrollments (
          id          SERIAL PRIMARY KEY,
          student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id    INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          enrolled_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (student_id, class_id)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS marks (
          id          SERIAL PRIMARY KEY,
          student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          subject_id  INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
          teacher_id  INT REFERENCES teachers(id) ON DELETE SET NULL,
          semester    VARCHAR(20) NOT NULL DEFAULT 'Semester 1' CHECK (semester IN ('Semester 1', 'Semester 2')),
          assignment  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (assignment >= 0 AND assignment <= 30),
          mid         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (mid >= 0 AND mid <= 30),
          final       NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (final >= 0 AND final <= 40),
          total       NUMERIC(5,2) GENERATED ALWAYS AS (assignment + mid + final) STORED,
          status      VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','compiled')),
          created_at  TIMESTAMPTZ DEFAULT NOW(),
          updated_at  TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (student_id, subject_id, semester)
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_marks_student_id  ON marks(student_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_marks_subject_id  ON marks(subject_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_marks_teacher_id  ON marks(teacher_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_enrollments_class   ON enrollments(class_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_students_user_id    ON students(user_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_teachers_user_id    ON teachers(user_id);
      `);

      // Create triggers
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $func$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS marks_updated_at ON marks;
      `);
      await client.query(`
        CREATE TRIGGER marks_updated_at
          BEFORE UPDATE ON marks
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS users_updated_at ON users;
      `);
      await client.query(`
        CREATE TRIGGER users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      `);

      console.log('✓ Base schema created successfully');
    }

    // Migration: Add columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects') THEN
          ALTER TABLE subjects
            ADD COLUMN IF NOT EXISTS department INT REFERENCES departments(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS pass_mark INT NOT NULL DEFAULT 50;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$ 
      BEGIN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers') THEN
          ALTER TABLE teachers
            ADD COLUMN IF NOT EXISTS subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS is_homeroom BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS homeroom_grade VARCHAR(20),
            ADD COLUMN IF NOT EXISTS homeroom_section VARCHAR(10);
        END IF;
      END $$;
    `);

    // Create or replace views
    await client.query(`
      CREATE OR REPLACE VIEW student_results AS
      SELECT
          s.id                                                AS student_id,
          s.name                                              AS student_name,
          s.grade,
          s.section,
          s.academic_year,
          s.semester,
          sub.id                                              AS subject_id,
          sub.name                                            AS subject_name,
          m.assignment,
          m.mid,
          m.final,
          m.total,
          CASE WHEN m.total >= sub.pass_mark THEN 'PASS' ELSE 'FAIL' END AS status
      FROM marks m
      JOIN students s   ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id;
    `);

    await client.query(`
      CREATE OR REPLACE VIEW student_summary AS
      SELECT
          s.id                                                           AS student_id,
          s.name                                                         AS student_name,
          s.grade,
          s.section,
          s.academic_year,
          s.semester,
          ROUND(AVG(m.total), 2)                                         AS average,
          SUM(m.total)                                                   AS grand_total,
          COUNT(m.id)                                                    AS subject_count,
          RANK() OVER (
              PARTITION BY s.grade, s.section, s.academic_year
              ORDER BY AVG(m.total) DESC
          )                                                              AS rank,
          CASE
              WHEN BOOL_AND(m.total >= sub.pass_mark) THEN 'PASS'
              ELSE 'FAIL'
          END                                                            AS overall_status
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      GROUP BY s.id, s.name, s.grade, s.section, s.academic_year, s.semester;
    `);

    await client.query('COMMIT');
    console.log('✓ Database schema verified/updated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Schema initialization error:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, ensureSchema, pool };
