# SARMS – Student Academic Record Management System

A production-ready full-stack web application for managing student academic records.

---

## Tech Stack

| Layer       | Technology                   |
|-------------|------------------------------|
| Frontend    | React 18 + Tailwind CSS      |
| Backend     | Node.js + Express.js (MVC)   |
| Database    | PostgreSQL                   |
| Auth        | JWT (Bearer token)           |
| Build Tool  | Vite                         |

---

## Folder Structure

```
SARMS/
├── database/
│   ├── schema.sql          # Full PostgreSQL schema (3NF)
│   └── seed.js             # Demo data seeder
│
├── backend/
│   ├── server.js
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── app.js
│       ├── config/
│       │   └── db.js
│       ├── middleware/
│       │   ├── authenticate.js   # JWT verification
│       │   ├── authorize.js      # Role-based access
│       │   └── validate.js       # Input validation
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── studentController.js
│       │   ├── teacherController.js
│       │   ├── subjectController.js
│       │   ├── classController.js
│       │   ├── markController.js
│       │   └── reportController.js
│       └── routes/
│           ├── index.js
│           ├── authRoutes.js
│           ├── studentRoutes.js
│           ├── teacherRoutes.js
│           ├── subjectRoutes.js
│           ├── classRoutes.js
│           ├── markRoutes.js
│           └── reportRoutes.js
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx               # Route definitions
        ├── index.css
        ├── api/
        │   └── axios.js          # Axios instance + interceptors
        ├── context/
        │   └── AuthContext.jsx   # Auth state + login/logout
        ├── components/
        │   ├── PrivateRoute.jsx  # Role-guard + layout shell
        │   ├── Sidebar.jsx
        │   ├── Navbar.jsx
        │   ├── Modal.jsx
        │   ├── LoadingSpinner.jsx
        │   └── StatCard.jsx
        └── pages/
            ├── Login.jsx
            ├── Unauthorized.jsx
            ├── NotFound.jsx
            ├── admin/
            │   ├── Dashboard.jsx
            │   ├── Students.jsx  (CRUD)
            │   ├── Teachers.jsx  (CRUD)
            │   ├── Subjects.jsx  (CRUD)
            │   ├── Classes.jsx   (enroll / assign)
            │   └── Reports.jsx   (ranked summary table)
            ├── teacher/
            │   ├── Dashboard.jsx (assigned classes)
            │   └── Marks.jsx     (bulk mark entry)
            └── student/
                └── Dashboard.jsx (report card)
```

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **npm** ≥ 9

---

## Step-by-Step Setup

### 1. Clone / Copy the project

```bash
cd Desktop/ERROR/SARMS
```

### 2. Create the PostgreSQL database

```sql
-- In psql or pgAdmin:
CREATE DATABASE sarms_db;
```

### 3. Run the schema

```bash
psql -U postgres -d sarms_db -f database/schema.sql
```

### 4. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=sarms_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password

JWT_SECRET=replace_with_long_random_string_min_32_chars
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:5173
```

### 5. Install backend dependencies

```bash
cd backend
npm install
```

### 6. Seed demo data

```bash
cd database
node seed.js
```

This creates:

| Role    | Email                  | Password     |
|---------|------------------------|--------------|
| Admin   | admin@sarms.edu        | Admin@123    |
| Teacher | teacher1@sarms.edu     | Teacher@123  |
| Student | student1@sarms.edu     | Student@123  |
| Student | student2@sarms.edu     | Student@123  |

### 7. Start the backend

```bash
cd backend
npm run dev
# API running at http://localhost:5000
```

### 8. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
# App at http://localhost:5173
```

### 9. Open the app

Navigate to `http://localhost:5173` and log in with a demo account.

---

## Role-Based Redirect Flow

```
Login → POST /api/auth/login
       └─ Returns JWT { id, email, role }
           ├── role = "admin"   → /admin/dashboard
           ├── role = "teacher" → /teacher/dashboard
           └── role = "student" → /student/dashboard
```

Each dashboard group is protected by `<PrivateRoute role="...">` which:
1. Checks `user` from `AuthContext`
2. If not authenticated → redirect `/login`
3. If wrong role → redirect `/unauthorized`
4. Otherwise renders `Sidebar + Navbar + <Outlet />`

---

## REST API Reference

### Auth
| Method | Endpoint        | Auth | Description           |
|--------|-----------------|------|-----------------------|
| POST   | /api/auth/login | —    | Login, returns JWT    |
| GET    | /api/auth/me    | ✓    | Current user profile  |

### Students
| Method | Endpoint            | Roles          |
|--------|---------------------|----------------|
| GET    | /api/students       | all            |
| GET    | /api/students/:id   | all            |
| POST   | /api/students       | admin          |
| PUT    | /api/students/:id   | admin          |
| DELETE | /api/students/:id   | admin          |

### Teachers
| Method | Endpoint                    | Roles          |
|--------|-----------------------------|----------------|
| GET    | /api/teachers               | all            |
| GET    | /api/teachers/me/assignments| teacher        |
| POST   | /api/teachers               | admin          |
| PUT    | /api/teachers/:id           | admin          |
| DELETE | /api/teachers/:id           | admin          |

### Marks
| Method | Endpoint                    | Roles             |
|--------|-----------------------------|-------------------|
| GET    | /api/marks                  | all               |
| GET    | /api/marks/student/:id      | admin/teacher/student |
| POST   | /api/marks                  | admin/teacher     |
| POST   | /api/marks/bulk             | admin/teacher     |
| PUT    | /api/marks/:id              | admin/teacher     |
| DELETE | /api/marks/:id              | admin             |

### Reports
| Method | Endpoint                    | Roles             |
|--------|-----------------------------|-------------------|
| GET    | /api/reports/overview       | admin             |
| GET    | /api/reports/all-students   | admin             |
| GET    | /api/reports/class/:id      | admin/teacher     |
| GET    | /api/reports/student/:id    | admin/teacher/student |

---

## Database Schema Summary

```
users            ← Base auth table (email, password, role)
  ├── students   ← Student profile (grade, section, academic_year)
  └── teachers   ← Teacher profile (department)

subjects         ← Subject definitions (total_mark = 100)
classes          ← Class definitions (grade, section, academic_year)

teacher_assignments ← Teacher → Subject → Class
enrollments         ← Student → Class

marks            ← assignment(/30) + mid(/30) + final(/40) = total(/100)
                    UNIQUE (student_id, subject_id)
                    Pass mark = 50

Views:
  student_results  ← Per-subject detail with PASS/FAIL
  student_summary  ← Average, grand total, RANK (window fn), overall status
```

---

## Mark Breakdown

| Component   | Max Marks |
|-------------|-----------|
| Assignment  | 30        |
| Mid Exam    | 30        |
| Final Exam  | 40        |
| **Total**   | **100**   |
| Pass Mark   | **50**    |

---

## Security Features

- Passwords hashed with **bcrypt** (salt rounds = 10)
- JWT tokens with configurable expiry
- Role middleware guards all sensitive routes
- Helmet HTTP security headers
- CORS restricted to frontend origin
- Input validation via express-validator
- SQL injection protected via parameterised queries (pg pool)
