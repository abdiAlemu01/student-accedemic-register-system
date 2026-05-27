import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/overview')
      .then(({ data }) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const cards = [
    { label: 'Total Students', value: stats?.totalStudents, color: 'blue',   icon: UsersIcon,  to: '/admin/students' },
    { label: 'Total Teachers', value: stats?.totalTeachers, color: 'purple', icon: TeachIcon,  to: '/admin/teachers' },
    { label: 'Subjects',       value: stats?.totalSubjects, color: 'yellow', icon: BookIcon,   to: '/admin/subjects' },
    { label: 'Classes',        value: stats?.totalClasses,  color: 'green',  icon: BuildIcon,  to: '/admin/classes' },
    { label: 'Passed',         value: stats?.passCount,     color: 'green',  icon: CheckIcon,  to: '/admin/reports' },
    { label: 'Failed',         value: stats?.failCount,     color: 'red',    icon: XIcon,      to: '/admin/reports' },
  ];

  const colorMap = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    red:    'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
        {/* <p className="text-gray-500 text-sm mt-1">Overview of the academic system</p> */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, color, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <div className={`card border flex items-center gap-4 hover:shadow-md
                            transition-shadow cursor-pointer ${colorMap[color]}`}>
              <div className="p-3 rounded-xl bg-white/70">
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium opacity-80">{label}</p>
                <p className="text-3xl font-bold">{value ?? 0}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pass/Fail bar */}
      {stats && stats.totalStudents > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Pass / Fail Rate</h2>
          <div className="flex rounded-full overflow-hidden h-5">
            <div
              className="bg-green-500 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${(stats.passCount / (stats.passCount + stats.failCount || 1)) * 100}%` }}
            >
              {stats.passCount > 0 && `${Math.round((stats.passCount / (stats.passCount + stats.failCount)) * 100)}%`}
            </div>
            <div
              className="bg-red-400 flex items-center justify-center text-xs text-white font-medium"
              style={{ width: `${(stats.failCount / (stats.passCount + stats.failCount || 1)) * 100}%` }}
            >
              {stats.failCount > 0 && `${Math.round((stats.failCount / (stats.passCount + stats.failCount)) * 100)}%`}
            </div>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Pass ({stats.passCount})</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Fail ({stats.failCount})</span>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Student',  to: '/admin/students' },
            { label: 'Add Teacher',  to: '/admin/teachers' },
            { label: 'Add Subject',  to: '/admin/subjects' },
            { label: 'View Reports', to: '/admin/reports' },
          ].map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className="text-center py-3 px-4 rounded-lg bg-gray-50 hover:bg-blue-50
                         text-sm font-medium text-gray-700 hover:text-blue-700 border
                         border-gray-200 hover:border-blue-200 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function TeachIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>;
}
function BookIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function BuildIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function CheckIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function XIcon({ className }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
