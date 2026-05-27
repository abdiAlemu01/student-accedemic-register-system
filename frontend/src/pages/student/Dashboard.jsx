import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function StudentDashboard() {
  const { user }                        = useAuth();
  const [studentId, setStudentId]       = useState(null);
  const [report,   setReport]           = useState(null);
  const [loading,  setLoading]          = useState(true);

  useEffect(() => {
    // Get own student record first
    api.get('/students').then(({ data }) => {
      if (data.length > 0) {
        const me = data[0];
        setStudentId(me.id);
        return api.get(`/reports/student/${me.id}`);
      }
    }).then((res) => {
      if (res?.data) setReport(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const { subjects = [], summary } = report || {};

  const currentSemesterKey = useMemo(() => {
    const raw = String(summary?.semester || '').toLowerCase();
    if (raw.includes('1')) return 'sem1';
    if (raw.includes('2')) return 'sem2';
    return 'unknown';
  }, [summary?.semester]);

  const semesterData = useMemo(() => {
    const empty = { subjects: [], summary: null };

    const sem1 = currentSemesterKey === 'sem1'
      ? { subjects, summary: summary || null }
      : empty;

    const sem2 = currentSemesterKey === 'sem2'
      ? { subjects, summary: summary || null }
      : empty;

    // Overall currently reflects the available semester summary in this schema.
    const overall = { subjects, summary: summary || null };

    return { sem1, sem2, overall };
  }, [subjects, summary, currentSemesterKey]);

  const renderSummaryCards = (data) => {
    const passCount = data.subjects.filter((s) => s.status === 'PASS').length;
    const failCount = data.subjects.filter((s) => s.status === 'FAIL').length;
    const pendingCount = data.subjects.filter((s) => s.status === 'PENDING').length;
    const allSubmitted = data.subjects.length > 0 && pendingCount === 0;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Average', value: data.summary ? `${data.summary.average}%` : '—', color: 'text-blue-600' },
          { label: 'Rank', value: data.summary && allSubmitted ? `#${data.summary.rank}` : '—', color: 'text-indigo-600' },
          { label: 'Pass', value: passCount, color: 'text-green-600' },
          { label: 'Fail', value: failCount, color: 'text-red-600' },
          { label: 'Pending', value: pendingCount, color: 'text-yellow-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center p-3">
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderSubjectAssessments = (data, emptyText) => {
    if (!data.subjects.length) {
      return <div className="card text-center py-6 text-gray-400">{emptyText}</div>;
    }

    return (
      <div className="space-y-3">
        <div className="px-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Subject-wise Assessments</h3>
          <span className="text-xs text-gray-400">{data.subjects.length} subjects</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {data.subjects.map((s) => {
            const pending = s.status === 'PENDING';
            const total = pending ? 0 : Number(s.total || 0);

            return (
              <div
                key={s.subject_id}
                className={`card p-4 border ${pending ? 'border-gray-200' : 'border-gray-100'} ${pending ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-base font-semibold text-gray-800">{s.subject_name}</h4>
                  {pending ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                      PENDING
                    </span>
                  ) : (
                    <span className={s.status === 'PASS' ? 'badge-pass' : 'badge-fail'}>{s.status}</span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Assignment', value: pending ? '—' : s.assignment, color: 'text-blue-600' },
                    { label: 'Mid', value: pending ? '—' : s.mid, color: 'text-purple-600' },
                    { label: 'Final', value: pending ? '—' : s.final, color: 'text-orange-600' },
                    { label: 'Total', value: pending ? '—' : total, color: 'text-gray-800' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const SemesterSection = ({ title, data, showAssessments = false, emptyAssessmentText = 'No assessments yet.' }) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {data.summary && (
          <span className="text-xs text-gray-500">
            Grade {data.summary.grade} – {data.summary.section} • {data.summary.academic_year}
          </span>
        )}
      </div>
      {renderSummaryCards(data)}
      {showAssessments && renderSubjectAssessments(data, emptyAssessmentText)}
    </section>
  );

  if (loading) return <LoadingSpinner />;

  const overallPendingCount = subjects.filter((s) => s.status === 'PENDING').length;
  const showOverallRank = subjects.length > 0 && overallPendingCount === 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-100 text-sm">Welcome back</p>
            <h1 className="text-2xl font-bold mt-0.5">{user?.name}</h1>
            {summary && (
              <div className="flex gap-4 mt-3">
                <div>
                  <p className="text-xs text-blue-200">Academic Year</p>
                  <p className="text-sm font-medium">{summary.academic_year}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Semester</p>
                  <p className="text-sm font-medium">{summary.semester || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-200">Grade / Section</p>
                  <p className="text-sm font-medium">Grade {summary.grade} – {summary.section}</p>
                </div>
              </div>
            )}
          </div>
          {summary && (
            <div className="text-right">
              <p className="text-xs text-blue-200">Class Rank</p>
              <p className="text-4xl font-black">{showOverallRank ? `#${summary.rank}` : '—'}</p>
            </div>
          )}
        </div>
      </div>

      <SemesterSection
        title="See your result"
        data={semesterData.sem1}
        showAssessments
        emptyAssessmentText="No Semester 1 subject assessments available yet."
      />





     
    </div>
  );
}
