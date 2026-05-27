import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

/* ─────────────────────────────────────────────────────────────────
   Visual sub-components (no logic — pure UI)
───────────────────────────────────────────────────────────────── */

function StatCard({ label, value, color, icon }) {
  const palette = {
    blue:   { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/60',   border: 'border-blue-200/60',   text: 'text-blue-600',   icon: 'bg-blue-100 text-blue-500'   },
    purple: { bg: 'bg-gradient-to-br from-purple-50 to-purple-100/60', border: 'border-purple-200/60', text: 'text-purple-600', icon: 'bg-purple-100 text-purple-500' },
    green:  { bg: 'bg-gradient-to-br from-green-50 to-emerald-100/60', border: 'border-green-200/60',  text: 'text-emerald-600',icon: 'bg-green-100 text-green-500'  },
    orange: { bg: 'bg-gradient-to-br from-orange-50 to-amber-100/60',  border: 'border-orange-200/60', text: 'text-orange-500', icon: 'bg-orange-100 text-orange-400' },
  };
  const p = palette[color] ?? palette.blue;
  return (
    <div className={`rounded-2xl border ${p.bg} ${p.border} p-5 flex items-center gap-4 shadow-sm`}>
      {icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.icon} text-lg`}>
          {icon}
        </div>
      )}
      <div>
        <p className={`text-3xl font-bold leading-none ${p.text}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-1.5 font-medium">{label}</p>
      </div>
    </div>
  );
}

function WorkflowBanner({ isHomeroom }) {
  const steps = isHomeroom
    ? [
        { n: 1, label: 'Subject teachers submit' },
        { n: 2, label: 'You review marks' },
        { n: 3, label: 'You compile results' },
        { n: 4, label: 'Results finalized' },
      ]
    : [
        { n: 1, label: 'Enter marks' },
        { n: 2, label: 'Save all marks' },
        { n: 3, label: 'Submit to homeroom' },
      ];

  const [c, arrow] = isHomeroom
    ? ['border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50', 'text-emerald-300']
    : ['border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50', 'text-indigo-300'];

  const dotColor = isHomeroom ? 'bg-emerald-600' : 'bg-indigo-600';
  const labelColor = isHomeroom ? 'text-emerald-800' : 'text-indigo-800';
  const headColor  = isHomeroom ? 'text-emerald-700' : 'text-indigo-700';

  return (
    <div className={`rounded-2xl border ${c} px-5 py-4`}>
      <p className={`text-xs font-bold ${headColor} uppercase tracking-widest mb-3`}>
        {isHomeroom ? '🏠 Homeroom Teacher Workflow' : '📚 Subject Teacher Workflow'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <span key={s.n} className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full ${dotColor} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                {s.n}
              </span>
              <span className={`text-sm font-medium ${labelColor}`}>{s.label}</span>
            </span>
            {i < steps.length - 1 && <span className={`${arrow} font-bold`}>›</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

const STEP_ACCENT = [
  'from-indigo-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
];

function StepCard({ step, title, subtitle, statusBadge, children }) {
  const accent = STEP_ACCENT[(step - 1) % STEP_ACCENT.length];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* coloured top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
      <div className="px-6 py-4 flex items-start gap-4 border-b border-gray-100">
        {/* step number */}
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0 shadow-sm`}>
          {step}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            {statusBadge}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ type }) {
  const map = {
    complete: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    ready:    'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    partial:  'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    pending:  'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  };
  const labels = {
    complete: '✓ Complete',
    ready:    '✓ Ready',
    partial:  '⏳ In Progress',
    pending:  'Pending',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[type] ?? map.pending}`}>
      {labels[type] ?? 'Pending'}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main Dashboard Component — ALL LOGIC UNCHANGED
───────────────────────────────────────────────────────────────── */

export default function TeacherDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  /* ── State ─────────────────────────────────────────────────────── */
  const [loading,         setLoading]         = useState(true);
  const [teacherProfile,  setTeacherProfile]  = useState(null);
  const [classes,         setClasses]         = useState([]);
  const [students,        setStudents]        = useState([]);
  const [marks,           setMarks]           = useState([]);
  const [subjects,        setSubjects]        = useState([]);

  // Homeroom-specific
  const [homeroomClass,   setHomeroomClass]   = useState(null);
  const [subjectStatus,   setSubjectStatus]   = useState([]);
  const [submittedMarks,  setSubmittedMarks]  = useState([]);
  const [compiledResults, setCompiledResults] = useState([]);
  const [compileLoading,  setCompileLoading]  = useState(false);
  const [compileError,    setCompileError]    = useState('');
  const [compileProgress, setCompileProgress] = useState(null);

  // UI
  const [search,    setSearch]    = useState('');
  const [filterCls, setFilterCls] = useState('all');

  /* ── Data loader ───────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: assignments }, { data: teachers }, { data: allClasses }] = await Promise.all([
        api.get('/teachers/me/assignments'),
        api.get('/teachers'),
        api.get('/classes'),
      ]);

      const myProfile = (teachers || []).find(
        (t) => String(t.email || '').toLowerCase() === String(user?.email || '').toLowerCase()
      ) || null;
      setTeacherProfile(myProfile);

      const classMap = {};
      const subjMap  = {};
      (assignments || []).forEach((a) => {
        if (!classMap[a.class_id]) {
          classMap[a.class_id] = { id: a.class_id, grade: a.grade, section: a.section, subjects: [] };
        }
        if (a.subject_id) {
          classMap[a.class_id].subjects.push({ id: a.subject_id, name: a.subject_name });
          subjMap[a.subject_id] = a.subject_name;
        }
      });

      let myHomeroomClass = null;
      if (myProfile?.is_homeroom) {
        myHomeroomClass = (allClasses || []).find(
          (c) =>
            String(c.grade)   === String(myProfile.homeroom_grade) &&
            String(c.section) === String(myProfile.homeroom_section)
        ) || null;
        if (myHomeroomClass && !classMap[myHomeroomClass.id]) {
          classMap[myHomeroomClass.id] = {
            id: myHomeroomClass.id, grade: myHomeroomClass.grade,
            section: myHomeroomClass.section, subjects: [],
          };
        }
      }

      const classArr = Object.values(classMap).sort((a) =>
        myHomeroomClass && String(a.id) === String(myHomeroomClass.id) ? -1 : 0
      );

      setClasses(classArr);
      setSubjects(Object.entries(subjMap).map(([id, name]) => ({ id: Number(id), name })));
      setHomeroomClass(myHomeroomClass);

      const studentResults = await Promise.all(
        classArr.map((c) =>
          api.get(`/classes/${c.id}/students`).then(({ data }) =>
            (data || []).map((s) => ({ ...s, classId: c.id, grade: c.grade, section: c.section }))
          ).catch(() => [])
        )
      );
      const seen = new Set();
      const flat = [];
      studentResults.flat().forEach((s) => {
        if (!seen.has(s.id)) { seen.add(s.id); flat.push(s); }
      });
      setStudents(flat);

      const { data: mData } = await api.get('/marks').catch(() => ({ data: [] }));
      setMarks(mData || []);

      if (myProfile?.is_homeroom && myHomeroomClass) {
        api.get(`/classes/${myHomeroomClass.id}/assignments`)
          .then(({ data }) => setSubjectStatus(data || []))
          .catch(() => setSubjectStatus([]));

        api.get(`/marks/class/${myHomeroomClass.id}/submitted`)
          .then(({ data }) => setSubmittedMarks(data || []))
          .catch(() => setSubmittedMarks([]));

        api.get(`/reports/class/${myHomeroomClass.id}`)
          .then(({ data }) => {
            setCompiledResults(data || []);
            setCompileError('');
            setCompileProgress(null);
          })
          .catch((err) => {
            setCompiledResults([]);
            setCompileError(
              err.response?.data?.error ||
              'Results not compiled yet. All subject teachers must submit first.'
            );
            setCompileProgress(err.response?.data?.progress || null);
          });
      } else {
        setHomeroomClass(null);
        setSubjectStatus([]);
        setSubmittedMarks([]);
        setCompiledResults([]);
        setCompileError('');
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Compile handler ────────────────────────────────────────────── */
  const handleCompile = async () => {
    if (!homeroomClass) return;
    setCompileLoading(true);
    setCompileError('');
    try {
      await api.post(`/marks/class/${homeroomClass.id}/compile`);
      toast.success('Marks compiled successfully! Results are now final.');

      const [compiledRes, submittedRes] = await Promise.all([
        api.get(`/reports/class/${homeroomClass.id}`).catch(() => ({ data: [] })),
        api.get(`/marks/class/${homeroomClass.id}/submitted`).catch(() => ({ data: [] })),
      ]);
      setCompiledResults(compiledRes.data || []);
      setSubmittedMarks(submittedRes.data || []);
      setCompileError('');
      setCompileProgress(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to compile marks.';
      setCompileError(msg);
      setCompileProgress(err.response?.data?.progress || null);
      toast.error(msg);
    } finally {
      setCompileLoading(false);
    }
  };

  /* ── Helpers ────────────────────────────────────────────────────── */
  const markEntered       = (studentId, subjectId) =>
    marks.some((m) => m.student_id === studentId && m.subject_id === subjectId);
  const marksEnteredCount = (studentId) =>
    subjects.filter((s) => markEntered(studentId, s.id)).length;

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) &&
      (filterCls === 'all' || String(s.classId) === String(filterCls))
    );
  });

  const totalMarksNeeded  = students.length * subjects.length;
  const totalMarksEntered = students.reduce((sum, s) => sum + marksEnteredCount(s.id), 0);
  const pendingCount      = totalMarksNeeded - totalMarksEntered;

  const allSubjectsSubmitted  = subjectStatus.length > 0 && subjectStatus.every((a) => Boolean(a.submitted));
  const submittedSubjectCount = subjectStatus.filter((a) => a.submitted).length;

  const compiledByStudent = compiledResults.reduce((acc, row) => {
    acc[row.student_id] = row;
    return acc;
  }, {});

  const primaryClassLabel =
    homeroomClass
      ? `Grade ${homeroomClass.grade} / Section ${homeroomClass.section}`
      : classes.length > 0
      ? `Grade ${classes[0].grade} / Section ${classes[0].section}`
      : 'Not assigned yet';

  /* ── Render ─────────────────────────────────────────────────────── */
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Teacher Dashboard</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className="text-sm text-gray-500">
              Welcome, <span className="font-semibold text-gray-700">{user?.name || user?.email}</span>
            </p>
            {teacherProfile?.is_homeroom ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold ring-1 ring-emerald-200">
                🏠 Homeroom · Grade {teacherProfile.homeroom_grade} / {teacherProfile.homeroom_section}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold ring-1 ring-indigo-200">
                📚 Subject Teacher
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate('/teacher/marks')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Enter Marks
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Classes"      value={classes.length}  color="blue"   icon="🏫" />
        <StatCard label="Subjects"     value={subjects.length} color="purple" icon="📚" />
        <StatCard label="Students"     value={students.length} color="green"  icon="🎓" />
        <StatCard label="Marks Pending" value={pendingCount}   color={pendingCount > 0 ? 'orange' : 'green'} icon={pendingCount > 0 ? '⏳' : '✅'} />
      </div>

      {/* ── Workflow banner ──────────────────────────────────────────── */}
      <WorkflowBanner isHomeroom={teacherProfile?.is_homeroom} />

      {/* ════════════════════════════════════════════════════════════════
          HOMEROOM SECTION — 4-step pipeline
      ════════════════════════════════════════════════════════════════ */}
      {teacherProfile?.is_homeroom && homeroomClass && (
        <div className="space-y-5">

          {/* ── STEP 1 – Subject Submission Status ─────────────────── */}
          <StepCard
            step={1}
            title="Subject Submission Status"
            subtitle="Track which subject teachers have submitted marks for your class"
            statusBadge={
              <StatusBadge type={
                allSubjectsSubmitted ? 'complete' :
                submittedSubjectCount > 0 ? 'partial' : 'pending'
              } />
            }
          >
            {subjectStatus.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm text-gray-400">No subject teachers assigned to this class yet.</p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                    <span className="font-medium">Submission progress</span>
                    <span className="font-bold text-gray-700">
                      {submittedSubjectCount} / {subjectStatus.length} submitted
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                      style={{ width: `${subjectStatus.length > 0 ? (submittedSubjectCount / subjectStatus.length) * 100 : 0}%` }}
                    />
                  </div>
                  {!allSubjectsSubmitted && (
                    <p className="text-xs text-amber-600 font-medium mt-1.5">
                      ⚠ Waiting for {subjectStatus.length - submittedSubjectCount} more teacher{subjectStatus.length - submittedSubjectCount !== 1 ? 's' : ''} to submit
                    </p>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 bg-gray-50/80">
                        <th className="table-header">Subject</th>
                        <th className="table-header">Teacher</th>
                        <th className="table-header text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subjectStatus.map((a, i) => (
                        <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                          <td className="table-cell font-semibold text-gray-800">
                            {a.subject_name || a.name || '—'}
                          </td>
                          <td className="table-cell text-gray-500">{a.teacher_name || '—'}</td>
                          <td className="table-cell text-center">
                            {a.submitted ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </StepCard>

          {/* ── STEP 2 – Review Submitted Marks ────────────────────── */}
          <StepCard
            step={2}
            title="Review Submitted Marks"
            subtitle="All marks submitted by subject teachers — verify before compiling"
            statusBadge={<StatusBadge type={submittedMarks.length > 0 ? 'partial' : 'pending'} />}
          >
            {submittedMarks.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm text-gray-400">No marks submitted yet. Subject teachers must save and submit first.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-y border-gray-100 bg-gray-50/80">
                        <th className="table-header">Student</th>
                        <th className="table-header">Subject</th>
                        <th className="table-header">By</th>
                        <th className="table-header text-center">
                          <span className="text-blue-600">Assign</span>
                          <span className="text-gray-400 font-normal ml-0.5">/30</span>
                        </th>
                        <th className="table-header text-center">
                          <span className="text-violet-600">Mid</span>
                          <span className="text-gray-400 font-normal ml-0.5">/30</span>
                        </th>
                        <th className="table-header text-center">
                          <span className="text-orange-500">Final</span>
                          <span className="text-gray-400 font-normal ml-0.5">/40</span>
                        </th>
                        <th className="table-header text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {submittedMarks.map((m) => {
                        const tot  = Number(m.total ?? (Number(m.assignment || 0) + Number(m.mid || 0) + Number(m.final || 0)));
                        const pass = tot >= 50;
                        return (
                          <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="table-cell">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {String(m.student_name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-800">
                                  {m.student_name || `Student #${m.student_id}`}
                                </span>
                              </div>
                            </td>
                            <td className="table-cell">
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                                {m.subject_name}
                              </span>
                            </td>
                            <td className="table-cell text-gray-400 text-xs">{m.teacher_name || '—'}</td>
                            <td className="table-cell text-center">
                              <span className="font-bold text-blue-600">{m.assignment}</span>
                            </td>
                            <td className="table-cell text-center">
                              <span className="font-bold text-violet-600">{m.mid}</span>
                            </td>
                            <td className="table-cell text-center">
                              <span className="font-bold text-orange-500">{m.final}</span>
                            </td>
                            <td className="table-cell text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                pass
                                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                                  : 'bg-red-100 text-red-600 ring-1 ring-red-200'
                              }`}>
                                {tot}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400 font-medium">
                  {submittedMarks.length} record{submittedMarks.length !== 1 ? 's' : ''} awaiting compilation
                </div>
              </>
            )}
          </StepCard>

          {/* ── STEP 3 – Compile ────────────────────────────────────── */}
          <StepCard
            step={3}
            title="Compile Final Results"
            subtitle={
              allSubjectsSubmitted
                ? 'All subjects submitted — ready to compile!'
                : `Waiting for ${subjectStatus.filter((a) => !a.submitted).length} more subject teacher(s) to submit`
            }
            statusBadge={
              <StatusBadge type={
                compiledResults.length > 0 ? 'complete' :
                allSubjectsSubmitted ? 'ready' : 'pending'
              } />
            }
          >
            <div className="p-6 space-y-4">
              {/* Locked warning */}
              {!allSubjectsSubmitted && (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                  <div className="text-xl flex-shrink-0">🔒</div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-0.5">Compilation locked</p>
                    <p className="text-xs text-amber-700">
                      All subject teachers must submit before you can compile.
                    </p>
                    {compileProgress && (
                      <p className="text-xs text-amber-600 mt-1">
                        Records received: <strong>{compileProgress.submitted}</strong> / {compileProgress.expected}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {compileError && allSubjectsSubmitted && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                  <div className="text-xl flex-shrink-0">⚠️</div>
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-0.5">Compilation error</p>
                    <p className="text-xs text-red-600">{compileError}</p>
                    {compileProgress && (
                      <p className="text-xs text-red-500 mt-1">
                        Received {compileProgress.submitted}/{compileProgress.expected} — missing {compileProgress.missing}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Success */}
              {compiledResults.length > 0 && (
                <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                  <div className="text-xl flex-shrink-0">✅</div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800 mb-0.5">Results compiled!</p>
                    <p className="text-xs text-emerald-700">
                      <strong>{compiledResults.length}</strong> students ranked. See Step 4 below for the final results.
                    </p>
                  </div>
                </div>
              )}

              {/* Compile button */}
              <div className="flex items-center gap-4 pt-1">
                <button
                  onClick={handleCompile}
                  disabled={compileLoading || !allSubjectsSubmitted}
                  className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold shadow-md transition-all active:scale-[0.98] ${
                    allSubjectsSubmitted && !compileLoading
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {compileLoading ? (
                    <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Compiling…</>
                  ) : compiledResults.length > 0 ? (
                    <>🔄 Re-Compile Marks</>
                  ) : (
                    <>🔒 Compile All Marks</>
                  )}
                </button>
                {!allSubjectsSubmitted && (
                  <p className="text-xs text-gray-400">Unlocks when all subjects are submitted</p>
                )}
              </div>
            </div>
          </StepCard>

          {/* ── STEP 4 – Final Compiled Results ─────────────────────── */}
          {compiledResults.length > 0 && (
            <StepCard
              step={4}
              title="Final Compiled Results"
              subtitle={`Class ranking · Grade ${homeroomClass.grade} / Section ${homeroomClass.section}`}
              statusBadge={<StatusBadge type="complete" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-gray-100 bg-gray-50/80">
                      <th className="table-header text-center">Rank</th>
                      <th className="table-header">Student</th>
                      <th className="table-header text-center">Average</th>
                      <th className="table-header text-center">Grand Total</th>
                      <th className="table-header text-center">Grade</th>
                      <th className="table-header text-center">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {compiledResults.map((row) => {
                      const medal =
                        row.rank === 1 ? { bg: 'bg-yellow-100 text-yellow-700 ring-yellow-300', icon: '🥇' } :
                        row.rank === 2 ? { bg: 'bg-gray-200 text-gray-600 ring-gray-300',        icon: '🥈' } :
                        row.rank === 3 ? { bg: 'bg-orange-100 text-orange-600 ring-orange-300',  icon: '🥉' } :
                                         { bg: 'bg-gray-50 text-gray-400 ring-gray-200',          icon: null };
                      const gradeColors = {
                        A: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
                        B: 'bg-blue-100   text-blue-700   ring-blue-200',
                        C: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
                        D: 'bg-orange-100 text-orange-600 ring-orange-200',
                        F: 'bg-red-100   text-red-600    ring-red-200',
                      };
                      return (
                        <tr
                          key={row.student_id}
                          className={`transition-colors ${row.rank <= 3 ? 'bg-gradient-to-r from-transparent to-yellow-50/20' : 'hover:bg-gray-50/60'}`}
                        >
                          <td className="table-cell text-center">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-extrabold ring-1 ${medal.bg}`}>
                              {medal.icon || `#${row.rank}`}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {String(row.student_name || '?').split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{row.student_name}</p>
                                {row.rank === 1 && <p className="text-xs text-yellow-600 font-medium">🏆 Top of class</p>}
                              </div>
                            </div>
                          </td>
                          <td className="table-cell text-center">
                            <span className="font-bold text-indigo-600 text-base">{row.average}</span>
                          </td>
                          <td className="table-cell text-center">
                            <span className="font-semibold text-gray-700">{row.grand_total}</span>
                          </td>
                          <td className="table-cell text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ring-1 ${gradeColors[row.overall_grade] ?? gradeColors.F}`}>
                              {row.overall_grade || '—'}
                            </span>
                          </td>
                          <td className="table-cell text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${
                              row.overall_status === 'PASS'
                                ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                                : 'bg-red-100 text-red-600 ring-red-200'
                            }`}>
                              {row.overall_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Summary footer */}
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/60 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>Total students: <strong className="text-gray-700">{compiledResults.length}</strong></span>
                  <span>Passed: <strong className="text-emerald-700">{compiledResults.filter(r => r.overall_status === 'PASS').length}</strong></span>
                  <span>Failed: <strong className="text-red-600">{compiledResults.filter(r => r.overall_status === 'FAIL').length}</strong></span>
                  <span>Class average: <strong className="text-indigo-600">
                    {compiledResults.length > 0
                      ? (compiledResults.reduce((s, r) => s + Number(r.average || 0), 0) / compiledResults.length).toFixed(1)
                      : '—'}
                  </strong></span>
                </div>
              </div>
            </StepCard>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STUDENT LIST SECTION
      ════════════════════════════════════════════════════════════════ */}

      {/* Assigned section info */}
      {classes.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Assigned Section</p>
              <h2 className="text-lg font-bold text-gray-800 mt-1">My Students</h2>
              <p className="text-sm text-gray-500 mt-0.5">All students in your assigned class(es).</p>
            </div>
            <span className="self-start inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 border border-emerald-200 text-sm font-bold text-emerald-700 shadow-sm">
              {primaryClassLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Grade',   value: homeroomClass?.grade   || classes[0]?.grade   || teacherProfile?.homeroom_grade   || '—' },
              { label: 'Section', value: homeroomClass?.section || classes[0]?.section || teacherProfile?.homeroom_section || '—' },
              { label: 'Subject', value: teacherProfile?.subject_name || subjects[0]?.name || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white border border-emerald-100 p-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No classes empty state */}
      {classes.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white flex flex-col items-center justify-center py-20 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4 text-3xl">📭</div>
          <p className="text-base font-bold text-gray-700">No classes assigned yet</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            The admin must assign you to a class and subject before students appear here.
          </p>
        </div>
      )}

      {/* Search + Filter */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                 fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="input pl-9 rounded-xl"
              placeholder="Search student…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[{ id: 'all', label: 'All Classes' }, ...classes.map((c) => ({ id: String(c.id), label: `Grade ${c.grade} – ${c.section}` }))].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilterCls(btn.id)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                  filterCls === btn.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Student Table */}
      {students.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-700">
              {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              {filterCls !== 'all' && ' in selected class'}
            </p>
            <p className="text-xs text-gray-400 hidden sm:block">
              {totalMarksEntered} / {totalMarksNeeded} marks entered
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No students match your search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="table-header w-10">#</th>
                    <th className="table-header">Student</th>
                    <th className="table-header">Class</th>
                    <th className="table-header">Gender</th>
                    {subjects.map((s) => (
                      <th key={s.id} className="table-header text-center">{s.name}</th>
                    ))}
                    {compiledResults.length > 0 && (
                      <>
                        <th className="table-header text-center">Total</th>
                        <th className="table-header text-center">Avg</th>
                        <th className="table-header text-center">Rank</th>
                      </>
                    )}
                    <th className="table-header text-center">Progress</th>
                    <th className="table-header text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((st, i) => {
                    const done  = marksEnteredCount(st.id);
                    const total = subjects.length;
                    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
                    const compiledRow = compiledByStudent[st.id];

                    return (
                      <tr key={st.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="table-cell text-gray-400 text-xs font-medium">{i + 1}</td>

                        {/* Student */}
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase">
                              {st.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">{st.name}</p>
                              <p className="text-xs text-gray-400">{st.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="table-cell">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold ring-1 ring-blue-100">
                            Grade {st.grade} – {st.section}
                          </span>
                        </td>

                        {/* Gender */}
                        <td className="table-cell capitalize text-gray-500 text-xs">{st.gender || '—'}</td>

                        {/* Mark ✓ / ○ per subject */}
                        {subjects.map((s) => {
                          const entered = markEntered(st.id, s.id);
                          return (
                            <td key={s.id} className="table-cell text-center">
                              {entered ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 ring-1 ring-emerald-200">
                                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                                  </svg>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                                  <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* Compiled summary columns */}
                        {compiledResults.length > 0 && (
                          <>
                            <td className="table-cell text-center font-bold text-gray-700">{compiledRow?.grand_total ?? '—'}</td>
                            <td className="table-cell text-center font-bold text-indigo-600">{compiledRow?.average ?? '—'}</td>
                            <td className="table-cell text-center font-bold text-gray-600">{compiledRow?.rank ? `#${compiledRow.rank}` : '—'}</td>
                          </>
                        )}

                        {/* Progress */}
                        <td className="table-cell text-center">
                          <div className="flex flex-col items-center gap-1 min-w-[60px]">
                            <span className="text-xs font-bold text-gray-600">{done}/{total}</span>
                            <div className="w-14 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  pct === 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
                                  pct > 0     ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                  'bg-gray-200'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="table-cell text-center">
                          <button
                            onClick={() => navigate(`/teacher/marks?classId=${st.classId}`)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                              done === total && total > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                          >
                            {done === total && total > 0 ? 'Edit Marks' : 'Enter Marks'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
