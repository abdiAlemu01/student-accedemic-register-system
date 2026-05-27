import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import PrivateRoute   from './components/PrivateRoute';
import LoadingSpinner from './components/LoadingSpinner';

import Login        from './pages/Login';
import Register     from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import NotFound     from './pages/NotFound';

// Admin pages
import AdminDashboard  from './pages/admin/Dashboard';
import AdminStudents   from './pages/admin/Students';
import AdminTeachers   from './pages/admin/Teachers';
import AdminSubjects   from './pages/admin/Subjects';
import AdminClasses    from './pages/admin/Classes';
import AdminReports    from './pages/admin/Reports';
import AssignTeacher   from './pages/admin/AssignTeacher';

// Teacher pages
import TeacherDashboard from './pages/teacher/Dashboard';
import TeacherMarks     from './pages/teacher/Marks';

// Student pages
import StudentDashboard from './pages/student/Dashboard';

export default function App() {
  const { loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <Routes>
      {/* Public */}
      <Route path="/login"        element={<Login />} />
      <Route path="/register"     element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Root redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* ── Admin ─────────────────────────────────────────────── */}
      <Route path="/admin" element={<PrivateRoute role="admin" />}>
        <Route index               element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"    element={<AdminDashboard />} />
        <Route path="students"     element={<AdminStudents />} />
        <Route path="teachers"     element={<AdminTeachers />} />
        <Route path="assign-teacher" element={<AssignTeacher />} />
        <Route path="subjects"     element={<AdminSubjects />} />
        <Route path="classes"      element={<AdminClasses />} />
        <Route path="reports"      element={<AdminReports />} />
      </Route>

      {/* ── Teacher ───────────────────────────────────────────── */}
      <Route path="/teacher" element={<PrivateRoute role="teacher" />}>
        <Route index            element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="marks"     element={<TeacherMarks />} />
      </Route>

      {/* ── Student ───────────────────────────────────────────── */}
      <Route path="/student" element={<PrivateRoute role="student" />}>
        <Route index            element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Redirect "/" based on user role */
function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}/dashboard`} replace />;
}
