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
 */
const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE subjects
        ADD COLUMN IF NOT EXISTS department VARCHAR(100),
        ADD COLUMN IF NOT EXISTS pass_mark INT NOT NULL DEFAULT 50;
    `);

    await client.query(`
      ALTER TABLE teachers
        ADD COLUMN IF NOT EXISTS subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS is_homeroom BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS homeroom_grade VARCHAR(20),
        ADD COLUMN IF NOT EXISTS homeroom_section VARCHAR(10);
    `);

    await client.query(`
      ALTER TABLE subjects
        ALTER COLUMN total_mark SET DEFAULT 100;
    `);

    // ── marks table: add status column if missing ──────────────
    await client.query(`
      ALTER TABLE marks
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft';
    `);

    // Add the CHECK constraint for status only if it doesn't exist yet
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'marks_status_check'
            AND conrelid = 'marks'::regclass
        ) THEN
          ALTER TABLE marks
            ADD CONSTRAINT marks_status_check
            CHECK (status IN ('draft','submitted','compiled'));
        END IF;
      END $$;
    `);

    // ── marks table: add semester column if missing ──────────────
    await client.query(`
      ALTER TABLE marks
        ADD COLUMN IF NOT EXISTS semester VARCHAR(20) NOT NULL DEFAULT 'Semester 1';
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'marks_semester_check'
            AND conrelid = 'marks'::regclass
        ) THEN
          ALTER TABLE marks
            ADD CONSTRAINT marks_semester_check
            CHECK (semester IN ('Semester 1', 'Semester 2'));
        END IF;
      END $$;
    `);

    // ── teacher_assignments: add submitted column if missing ─────
    await client.query(`
      ALTER TABLE teacher_assignments
        ADD COLUMN IF NOT EXISTS submitted BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'subjects_pass_mark_check'
        ) THEN
          ALTER TABLE subjects
            ADD CONSTRAINT subjects_pass_mark_check
            CHECK (pass_mark >= 0 AND pass_mark <= total_mark);
        END IF;
      END $$;
    `);

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
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, ensureSchema, pool };
