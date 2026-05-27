
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS teacher_assignments CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP VIEW IF EXISTS student_results CASCADE;
DROP VIEW IF EXISTS student_summary CASCADE;


CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('admin','teacher','student')),
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);



CREATE TABLE students (
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


CREATE TABLE teachers (
    id          SERIAL PRIMARY KEY,
    user_id     INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    department  INT REFERENCES departments(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE subjects (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
   department  INT REFERENCES departments(id) ON DELETE SET NULL,
    total_mark  INT NOT NULL DEFAULT 100 CHECK (total_mark > 0 AND total_mark <= 100),
    pass_mark   INT NOT NULL DEFAULT 50 CHECK (pass_mark >= 0 AND pass_mark <= total_mark),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);



CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);



CREATE TABLE classes (
    id            SERIAL PRIMARY KEY,
    grade         VARCHAR(20) NOT NULL,
    section       VARCHAR(10) NOT NULL,
    academic_year VARCHAR(20) NOT NULL DEFAULT '2024/25',
    UNIQUE (grade, section, academic_year)
);


CREATE TABLE teacher_assignments (
    id          SERIAL PRIMARY KEY,
    teacher_id  INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id  INT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id    INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    submitted   BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (teacher_id, subject_id, class_id)
);


CREATE TABLE enrollments (
    id          SERIAL PRIMARY KEY,
    student_id  INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id    INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, class_id)
);


CREATE TABLE marks (
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


CREATE INDEX idx_marks_student_id  ON marks(student_id);
CREATE INDEX idx_marks_subject_id  ON marks(subject_id);
CREATE INDEX idx_marks_teacher_id  ON marks(teacher_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class   ON enrollments(class_id);
CREATE INDEX idx_students_user_id    ON students(user_id);
CREATE INDEX idx_teachers_user_id    ON teachers(user_id);


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


CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marks_updated_at
    BEFORE UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
