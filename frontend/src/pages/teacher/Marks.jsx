import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function TeacherMarks() {
  const { user } = useAuth();
  const [searchParams]  = useSearchParams();
  const initClassId     = searchParams.get('classId') || '';

  const [assignments,     setAssignments]     = useState([]);
  const [classes,         setClasses]         = useState([]);
  const [students,        setStudents]        = useState([]);
  const [marks,           setMarks]           = useState({});
  const [savedMarks,      setSavedMarks]      = useState([]);

  const [selectedClass,   setSelectedClass]   = useState(initClassId);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('Semester 1');
  const [search, setSearch] = useState('');
  const [teacherProfile, setTeacherProfile] = useState(null);

  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [submitted, setSubmitted] = useState(false); // track if subject teacher submitted this assignment


  const firstInputRef = useRef(null);

  /* ── Load assignments once ──────────────────────────────────── */
  useEffect(() => {
    const loadBase = async () => {
      const [{ data: assignmentData }, { data: teachers }, { data: allClasses }] = await Promise.all([
        api.get('/teachers/me/assignments'),
        api.get('/teachers'),
        api.get('/classes'),
      ]);

      setAssignments(assignmentData || []);

      const myTeacher = (teachers || []).find((t) =>
        String(t.email || '').toLowerCase() === String(user?.email || '').toLowerCase()
      ) || null;
      setTeacherProfile(myTeacher);

      const seen = new Set();
      const cls  = [];
      (assignmentData || []).forEach((a) => {
        if (!seen.has(a.class_id)) {
          seen.add(a.class_id);
          cls.push({ id: a.class_id, grade: a.grade, section: a.section });
        }
      });

      const homeroomClass = myTeacher?.is_homeroom
        ? (allClasses || []).find(
            (c) =>
              String(c.grade) === String(myTeacher.homeroom_grade) &&
              String(c.section) === String(myTeacher.homeroom_section)
          )
        : null;

      if (homeroomClass && !cls.some((c) => String(c.id) === String(homeroomClass.id))) {
        cls.unshift({ id: homeroomClass.id, grade: homeroomClass.grade, section: homeroomClass.section });
      }

      setClasses(cls);
      if (!initClassId && cls.length > 0) {
        setSelectedClass(String(cls[0].id));
      }
    };

    loadBase().catch(() => {
      setAssignments([]);
      setClasses([]);
    });
  }, [initClassId, user?.email]);

  const subjectsForClass = (() => {
    const fromAssignments = assignments.filter(
      (a) => String(a.class_id) === String(selectedClass)
    );
    if (fromAssignments.length > 0) return fromAssignments;

    if (teacherProfile?.subject_id) {
      return [{
        subject_id: teacherProfile.subject_id,
        subject_name: teacherProfile.subject_name || 'Assigned Subject',
        class_id: selectedClass,
      }];
    }

    return [];
  })();

  useEffect(() => {
    if (!selectedClass) {
      setSelectedSubject('');
      return;
    }

    const hasCurrent = subjectsForClass.some(
      (s) => String(s.subject_id) === String(selectedSubject)
    );

    if (!hasCurrent) {
      const firstSubjectId = subjectsForClass[0]?.subject_id;
      setSelectedSubject(firstSubjectId ? String(firstSubjectId) : '');
    }
  }, [selectedClass, selectedSubject, subjectsForClass]);

  /* ── Load students when class changes ──────────────────────── */
  const loadStudents = useCallback(async () => {
    if (!selectedClass) { setStudents([]); return; }
    setLoading(true);
    const { data } = await api.get(`/classes/${selectedClass}/students`);
    setStudents(data);
    setLoading(false);
  }, [selectedClass]);

  useEffect(() => {
    loadStudents();
    setMarks({});
    setSavedMarks([]);
  }, [loadStudents]);

  /* ── Load existing marks when subject chosen ────────────────── */
  const loadMarks = useCallback(async () => {
    if (!selectedSubject || !students.length) return;
    const { data } = await api.get('/marks');
    setSavedMarks(data);
    const hasSemesterData = (data || []).some((m) => typeof m.semester !== 'undefined' && m.semester !== null);
    const map = {};
    students.forEach((s) => {
      const found = data.find(
        (m) => m.student_id === s.id &&
               String(m.subject_id) === String(selectedSubject) &&
               (!hasSemesterData || String(m.semester || 'Semester 1') === String(selectedSemester))
      );
      map[s.id] = {
        assignment: found ? Number(found.assignment) : '',
        mid:        found ? Number(found.mid)        : '',
        final:      found ? Number(found.final)      : '',
      };
    });
    setMarks(map);
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, [selectedSubject, students, selectedSemester]);

  useEffect(() => { loadMarks(); }, [loadMarks]);

  /* ── Clamp value to allowed range ───────────────────────────── */
  const MAX = { assignment: 30, mid: 30, final: 40 };

  const setMark = (studentId, field, value) => {
    const raw = value === '' ? '' : Math.min(Math.max(0, Number(value)), MAX[field]);
    setMarks((p) => ({ ...p, [studentId]: { ...p[studentId], [field]: raw } }));
  };

  const calcTotal = (m) =>
    (Number(m?.assignment || 0) + Number(m?.mid || 0) + Number(m?.final || 0));

  const isPrev = (sid) =>
    savedMarks.some((m) => {
      const hasSemester = typeof m.semester !== 'undefined' && m.semester !== null;
      return m.student_id === sid &&
             String(m.subject_id) === String(selectedSubject) &&
             (!hasSemester || String(m.semester || 'Semester 1') === String(selectedSemester));
    });

  /* ── Save all ────────────────────────────────────────────────── */

  const saveAll = async () => {
    if (!selectedSubject) return toast.error('Select a subject first');
    setSaving(true);
    try {
      const payload = students.map((s) => {
        const m = marks[s.id] || {};
        return {
          student_id: s.id,
          assignment: Number(m.assignment) || 0,
          mid:        Number(m.mid)        || 0,
          final:      Number(m.final)      || 0,
        };
      });
      await api.post('/marks/bulk', {
        subject_id: Number(selectedSubject),
        semester: selectedSemester,
        marks: payload,
      });
      toast.success('All marks saved!');
      loadMarks();
      setSubmitted(false); // Reset submit state after save
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving marks');
    } finally {
      setSaving(false);
    }
  };

  // Simulate submit-to-homeroom (in real app, call backend to set a submitted flag)
  const submitResults = async () => {
    if (!selectedSubject) return toast.error('Select a subject first');
    if (students.some((s) => !isPrev(s.id))) {
      return toast.error('Save all marks before submitting!');
    }
    try {
      await api.post('/marks/submit', {
        class_id: Number(selectedClass),
        subject_id: Number(selectedSubject)
      });
      setSubmitted(true);
      toast.success('Results submitted for homeroom review!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error submitting results');
    }
  };

  /* ── Keyboard: Tab moves to next input ───────────────────────── */
  const handleKeyDown = (e, sid, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const order = ['assignment', 'mid', 'final'];
      const idx   = order.indexOf(field);
      if (idx < order.length - 1) {
        document.getElementById(`mark-${sid}-${order[idx + 1]}`)?.focus();
      } else {
        const sIdx = students.findIndex((s) => s.id === sid);
        if (sIdx < students.length - 1) {
          document.getElementById(`mark-${students[sIdx + 1].id}-assignment`)?.focus();
        }
      }
    }
  };

  const savedCount = students.filter((s) => isPrev(s.id)).length;
  const classLabel = classes.find((c) => String(c.id) === String(selectedClass));
  const subjectLabel = subjectsForClass.find((s) => String(s.subject_id) === String(selectedSubject));

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const completedRows = students.filter((s) => {
    const m = marks[s.id] || {};
    return m.assignment !== '' && m.mid !== '' && m.final !== '';
  }).length;

  const progressPercent = students.length > 0
    ? Math.round((completedRows / students.length) * 100)
    : 0;

  const clearDraft = () => {
    const reset = {};
    students.forEach((s) => {
      reset[s.id] = { assignment: '', mid: '', final: '' };
    });
    setMarks(reset);
    toast.success('Draft marks cleared for this subject');
  };

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Enter Marks</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select class and subject, then fill in the marks for each student.
        </p>
      </div>

      {/* Step 1 & 2 — Class + Subject selectors */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Class */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase
                              tracking-wide mb-2">
              Step 1 — Class
            </label>
            <select
              className="input text-base"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Grade {c.grade} – Section {c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase
                              tracking-wide mb-2">
              Step 2 — Subject
            </label>
            <select
              className="input text-base"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedClass}
            >
              <option value="">Select subject…</option>
              {subjectsForClass.map((a) => (
                <option key={a.subject_id} value={a.subject_id}>
                  {a.subject_name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Step 3 — Semester
            </label>
            <select
              className="input text-base"
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setMarks({});
                setSavedMarks([]);
              }}
              disabled={!selectedClass || !selectedSubject}
            >
              <option>Semester 1</option>
              {/* <option>Semester 2</option> */}
            </select>
          </div>
        </div>

        {/* Mark breakdown reminder */}
        {selectedSubject && (
          <div className="mt-4 flex flex-wrap gap-3">
            {[
              { label: 'Assignment', max: 30, color: 'bg-blue-100 text-blue-700' },
              { label: 'Mid Exam',   max: 30, color: 'bg-purple-100 text-purple-700' },
              { label: 'Final Exam', max: 40, color: 'bg-orange-100 text-orange-700' },
              { label: 'Total',      max: 100, color: 'bg-gray-100 text-gray-700' },
              { label: 'Pass Mark',  max: 50,  color: 'bg-green-100 text-green-700' },
            ].map(({ label, max, color }) => (
              <span key={label}
                className={`text-xs font-semibold px-3 py-1 rounded-full ${color}`}>
                {label}: {max}
              </span>
            ))}
          </div>
        )}

        {selectedSubject && (
          <p className="mt-3 text-xs text-gray-500">
            Tip: Press <span className="font-semibold">Enter</span> to move to the next mark box quickly.
          </p>
        )}
      </div>

      {/* Empty states */}
      {!selectedClass && (
        <div className="card py-14 text-center text-gray-400">
          <p className="text-4xl mb-2">📋</p>
          <p className="font-medium">Select a class to begin</p>
        </div>
      )}
      {selectedClass && !selectedSubject && (
        <div className="card py-14 text-center text-gray-400">
          <p className="text-4xl mb-2">📚</p>
          <p className="font-medium">Now select a subject</p>
        </div>
      )}

      {/* Step 3 — Simple student-by-student mark entry */}
      {loading ? <LoadingSpinner /> : (
        selectedClass && selectedSubject && (
          <div className="space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <p className="text-xs text-gray-500">Selected Class</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {classLabel ? `Grade ${classLabel.grade} – ${classLabel.section}` : '—'}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Selected Subject</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">
                  {subjectLabel?.subject_name || '—'}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Selected Semester</p>
                <p className="text-lg font-semibold text-gray-800 mt-1">{selectedSemester}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Entry Progress</p>
                <p className="text-lg font-semibold text-blue-700 mt-1">
                  {completedRows}/{students.length} ({progressPercent}%)
                </p>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">

            {/* Table header bar */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200
                            flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold text-gray-700">
                  {filteredStudents.length} of {students.length} Students
                </p>
                {savedCount > 0 && (
                  <span className="text-xs text-green-700 bg-green-100
                                   px-2.5 py-0.5 rounded-full font-medium">
                    {savedCount} saved
                  </span>
                )}
                <span className="text-xs text-gray-400 hidden sm:block">
                  Press Enter to jump to next field
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={students.length === 0 || saving}
                  className="btn-secondary px-4"
                >
                  Clear Draft
                </button>
                <button
                  onClick={saveAll}
                  disabled={saving || students.length === 0}
                  className="btn-primary px-6"
                >
                  {saving ? 'Saving…' : 'Save All Marks'}
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-gray-100 bg-white">
              <input
                className="input max-w-sm"
                placeholder="Search student by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {students.length === 0 ? (
              <p className="py-12 text-center text-gray-400 text-sm">
                No students enrolled in this class.
              </p>
            ) : filteredStudents.length === 0 ? (
              <p className="py-12 text-center text-gray-400 text-sm">
                No students match your search.
              </p>
            ) : (
              <div className="p-4 space-y-3">
                {filteredStudents.map((s, i) => {
                  const m    = marks[s.id] || { assignment: '', mid: '', final: '' };
                  const tot  = calcTotal(m);
                  const pass = tot >= 50;
                  const prev = isPrev(s.id);

                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        prev ? 'border-green-200 bg-green-50/40' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700
                                          flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {s.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            tot >= 50 ? 'text-green-600' : tot > 0 ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            Total: {tot || '—'}
                          </span>
                          {tot > 0 && (
                            <span className={pass ? 'badge-pass' : 'badge-fail'}>
                              {pass ? 'PASS' : 'FAIL'}
                            </span>
                          )}
                          {prev && <span className="text-xs text-green-600">✓ saved</span>}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-blue-700 mb-1">Assignment ( /30 )</label>
                          <input
                            id={`mark-${s.id}-assignment`}
                            ref={i === 0 ? firstInputRef : null}
                            type="number"
                            min={0}
                            max={30}
                            step={1}
                            placeholder="0"
                            value={m.assignment}
                            onChange={(e) => setMark(s.id, 'assignment', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'assignment')}
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-purple-700 mb-1">Mid ( /30 )</label>
                          <input
                            id={`mark-${s.id}-mid`}
                            type="number"
                            min={0}
                            max={30}
                            step={1}
                            placeholder="0"
                            value={m.mid}
                            onChange={(e) => setMark(s.id, 'mid', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'mid')}
                            className="input"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-orange-700 mb-1">Final ( /40 )</label>
                          <input
                            id={`mark-${s.id}-final`}
                            type="number"
                            min={0}
                            max={40}
                            step={1}
                            placeholder="0"
                            value={m.final}
                            onChange={(e) => setMark(s.id, 'final', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, s.id, 'final')}
                            className="input"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom save/submit bar */}
            {students.length > 0 && (
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-gray-500">
                  {savedCount} of {students.length} students already have saved marks
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={saveAll}
                    disabled={saving}
                    className="btn-primary px-8 py-2.5 text-base"
                  >
                    {saving ? 'Saving…' : '💾  Save All Marks'}
                  </button>
                  <button
                    onClick={submitResults}
                    disabled={submitted || students.length === 0 || students.some((s) => !isPrev(s.id))}
                    className={`btn-secondary px-8 py-2.5 text-base ${submitted ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {submitted ? 'Submitted!' : 'Submit Results'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        )
      )}
    </div>
  );
}
