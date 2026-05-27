import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

const INITIAL_FORM = {
  teacher_id: '',
  subject_id: '',
  department: '',
  grade: '',
  section: '',
  is_homeroom: true,
};

export default function AssignTeacher() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);

  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [reportRows, setReportRows] = useState([]);
  const [sectionMarks, setSectionMarks] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const selectedTeacher = useMemo(
    () => teachers.find((t) => String(t.id) === String(form.teacher_id)),
    [teachers, form.teacher_id]
  );

  const departmentOptions = useMemo(() => {
    const departments = Array.from(
      new Set([
        ...subjects.map((s) => s.department).filter(Boolean),
        ...teachers.map((t) => t.department).filter(Boolean),
      ])
    );
    return departments.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [subjects, teachers]);

  const gradeOptions = useMemo(() => {
    const grades = Array.from(new Set(classes.map((c) => String(c.grade)).filter(Boolean)));
    return grades.sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes]);

  const sectionOptions = useMemo(() => {
    if (!form.grade) return [];
    const sections = classes
      .filter((c) => String(c.grade) === String(form.grade))
      .map((c) => String(c.section))
      .filter(Boolean);

    return Array.from(new Set(sections)).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [classes, form.grade]);

  const selectedClass = useMemo(() => {
    return classes.find(
      (c) => String(c.grade) === String(form.grade) && String(c.section) === String(form.section)
    );
  }, [classes, form.grade, form.section]);

  const classAverage = useMemo(() => {
    if (!reportRows.length) return 0;
    const sum = reportRows.reduce((acc, row) => acc + Number(row.average || 0), 0);
    return Number((sum / reportRows.length).toFixed(2));
  }, [reportRows]);

  const topRank = useMemo(() => {
    if (!reportRows.length) return '—';
    const rank = Math.min(...reportRows.map((row) => Number(row.rank || 9999)));
    return Number.isFinite(rank) ? rank : '—';
  }, [reportRows]);

  const loadBase = () => {
    setLoading(true);
    Promise.all([api.get('/teachers'), api.get('/subjects'), api.get('/classes'), api.get('/students')])
      .then(([teachersRes, subjectsRes, classesRes, studentsRes]) => {
        setTeachers(teachersRes.data || []);
        setSubjects(subjectsRes.data || []);
        setClasses(classesRes.data || []);
        setStudents(studentsRes.data || []);
      })
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Failed to load assignment data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadBase, []);

  useEffect(() => {
    if (!selectedTeacher) return;
    setForm((prev) => ({
      ...prev,
      department: prev.department || selectedTeacher.department || '',
      subject_id: prev.subject_id || String(selectedTeacher.subject_id || ''),
    }));
  }, [selectedTeacher]);

  useEffect(() => {
    if (!selectedClass || !form.is_homeroom) {
      setReportRows([]);
      setSectionMarks([]);
      return;
    }

    const loadHomeroomInsights = async () => {
      setAnalyticsLoading(true);
      try {
        const [{ data: classReport }, { data: allMarks }] = await Promise.all([
          api.get(`/reports/class/${selectedClass.id}`),
          api.get('/marks'),
        ]);

        const classStudents = students.filter(
          (s) => String(s.grade) === String(form.grade) && String(s.section) === String(form.section)
        );
        const classStudentIds = new Set(classStudents.map((s) => Number(s.id)));

        const marksForSection = (allMarks || [])
          .filter((mark) => classStudentIds.has(Number(mark.student_id)))
          .map((mark) => ({
            ...mark,
            total: Number(mark.assignment || 0) + Number(mark.mid || 0) + Number(mark.final || 0),
          }))
          .sort((a, b) => {
            if ((a.student_name || '') === (b.student_name || '')) {
              return (a.subject_name || '').localeCompare(b.subject_name || '');
            }
            return (a.student_name || '').localeCompare(b.student_name || '');
          });

        setReportRows(classReport || []);
        setSectionMarks(marksForSection);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load homeroom analytics');
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadHomeroomInsights();
  }, [selectedClass, form.is_homeroom, form.grade, form.section, students]);

  const handleAssign = async (e) => {
    e.preventDefault();

    if (!selectedTeacher) return toast.error('Please select a teacher name');
    if (!form.subject_id) return toast.error('Please select a subject');
    if (!form.department) return toast.error('Please select a department');
    if (!form.grade || !form.section) return toast.error('Please select grade and section');
    if (!selectedClass) return toast.error('Please select a valid class');

    setSaving(true);
    try {
      const payload = {
        name: selectedTeacher.name,
        email: selectedTeacher.email,
        department: form.department,
        subject_id: Number(form.subject_id),
        is_homeroom: Boolean(form.is_homeroom),
        homeroom_grade: form.is_homeroom ? form.grade : '',
        homeroom_section: form.is_homeroom ? form.section : '',
      };

      await api.put(`/teachers/${selectedTeacher.id}`, payload);

      // Always create a real class assignment so teacher dashboards/marks can load the section students.
      await api.post(`/classes/${selectedClass.id}/assignments`, {
        teacher_id: selectedTeacher.id,
        subject_id: Number(form.subject_id),
      });

      toast.success('Teacher assignment saved successfully');
      loadBase();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign teacher');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
    
        <h1 className="text-2xl font-bold text-gray-800">Assign Teacher</h1>
        
    

    

      <form onSubmit={handleAssign} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teacher Name</label>
            <select
              className="input"
              value={form.teacher_id}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="input"
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              required
            >
              <option value="">Select subject</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              className="input"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              required
            >
              <option value="">Select department</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
              {form.department && !departmentOptions.includes(form.department) && (
                <option value={form.department}>{form.department}</option>
              )}
            </select>
            {departmentOptions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No departments found yet. Create subjects with departments first.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <select
              className="input"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value, section: '' })}
              required
            >
              <option value="">Select grade</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select
              className="input"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              required
              disabled={!form.grade}
            >
              <option value="">{form.grade ? 'Select section' : 'Select grade first'}</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={form.is_homeroom}
                onChange={(e) => setForm({ ...form, is_homeroom: e.target.checked })}
              />
              Assign as Home Room
            </label>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving Assignment…' : 'Save Assignment'}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Homeroom Section Analytics</h2>
          <div className="text-sm text-gray-500">
            {form.grade && form.section ? `Grade ${form.grade} / Section ${form.section}` : 'Select grade & section'}
          </div>
        </div>

        {!form.is_homeroom && (
          <div className="card p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200">
            Homeroom analytics is visible only when <strong>Assign as Home Room</strong> is enabled.
          </div>
        )}

        {form.is_homeroom && !selectedClass && form.grade && form.section && (
          <div className="card p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200">
            Selected grade/section does not match an existing class record.
          </div>
        )}

        {analyticsLoading ? (
          <LoadingSpinner />
        ) : form.is_homeroom && selectedClass ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-xs text-gray-500">Students in Report</p>
                <p className="text-2xl font-semibold text-gray-800 mt-1">{reportRows.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Class Average</p>
                <p className="text-2xl font-semibold text-blue-700 mt-1">{classAverage}</p>
              </div>
              <div className="card p-4">
                <p className="text-xs text-gray-500">Top Rank</p>
                <p className="text-2xl font-semibold text-emerald-700 mt-1">{topRank}</p>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800">Section Report (Average & Rank)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="table-header">Rank</th>
                      <th className="table-header">Student</th>
                      <th className="table-header">Average</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-gray-400">No report data for this class yet.</td>
                      </tr>
                    )}
                    {reportRows.map((row) => (
                      <tr key={row.student_id} className="hover:bg-gray-50">
                        <td className="table-cell font-medium">{row.rank ?? '—'}</td>
                        <td className="table-cell">{row.student_name}</td>
                        <td className="table-cell font-semibold text-blue-700">{row.average ?? '—'}</td>
                        <td className="table-cell">
                          <span className={row.overall_status === 'PASS' ? 'badge-pass' : 'badge-fail'}>
                            {row.overall_status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800">All Student Marks in This Section</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="table-header">Student</th>
                      <th className="table-header">Subject</th>
                      <th className="table-header">Assignment</th>
                      <th className="table-header">Mid</th>
                      <th className="table-header">Final</th>
                      <th className="table-header">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sectionMarks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">No marks entered for this section yet.</td>
                      </tr>
                    )}
                    {sectionMarks.map((mark) => (
                      <tr key={`${mark.student_id}-${mark.subject_id}`} className="hover:bg-gray-50">
                        <td className="table-cell">{mark.student_name}</td>
                        <td className="table-cell">{mark.subject_name}</td>
                        <td className="table-cell">{mark.assignment}</td>
                        <td className="table-cell">{mark.mid}</td>
                        <td className="table-cell">{mark.final}</td>
                        <td className="table-cell font-semibold">{mark.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
