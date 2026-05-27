import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const EMPTY = {
  email: '',
  password: '',
  name: '',
  department: '',
  subject_id: '',
  is_homeroom: false,
  homeroom_class_id: '',
  homeroom_grade: '',
  homeroom_section: '',
};

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const homeroomCount = teachers.filter((t) => t.is_homeroom).length;
  const subjectTeacherCount = teachers.filter((t) => t.subject_id || t.subject_name).length;
  const existingDepartments = Array.from(new Set([
    ...subjects.map((s) => s.department).filter(Boolean),
    ...teachers.map((t) => t.department).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/teachers'), api.get('/subjects'), api.get('/classes')])
      .then(([teachersRes, subjectsRes, classesRes]) => {
        setTeachers(teachersRes.data);
        setSubjects(subjectsRes.data);
        setClasses(classesRes.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setHomeroomFromClass = (classId) => {
    const cls = classes.find((item) => String(item.id) === String(classId));
    setForm((prev) => ({
      ...prev,
      homeroom_class_id: classId,
      homeroom_grade: cls?.grade || '',
      homeroom_section: cls?.section || '',
    }));
  };

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (t) => {
    const matchedClass = classes.find(
      (item) => item.grade === t.homeroom_grade && item.section === t.homeroom_section
    );
    setEditing(t);
    setForm({
      email: t.email,
      password: '',
      name: t.name,
      department: t.department || '',
      subject_id: t.subject_id || '',
      is_homeroom: Boolean(t.is_homeroom),
      homeroom_class_id: matchedClass?.id || '',
      homeroom_grade: t.homeroom_grade || '',
      homeroom_section: t.homeroom_section || '',
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.is_homeroom && !form.homeroom_class_id) {
      toast.error('Please select a homeroom class');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id),
        is_homeroom: Boolean(form.is_homeroom),
        homeroom_grade: form.is_homeroom ? form.homeroom_grade : '',
        homeroom_section: form.is_homeroom ? form.homeroom_section : '',
      };
      if (editing) {
        await api.put(`/teachers/${editing.id}`, payload);
        toast.success('Teacher updated');
      } else {
        await api.post('/teachers', payload);
        toast.success('Teacher created');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this teacher?')) return;
    try {
      await api.delete(`/teachers/${id}`);
      toast.success('Teacher deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const filtered = teachers.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.department || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.subject_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Teachers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{teachers.length} registered</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Add Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Teachers</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{teachers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Homeroom Teachers</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{homeroomCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Subject Teachers</p>
          <p className="text-2xl font-semibold text-gray-800 mt-1">{subjectTeacherCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          className="input max-w-md"
          placeholder="Search by name, department, or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className="btn-secondary" onClick={() => setSearch('')}>
            Clear Search
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Email', 'Department', 'Subject', 'Homeroom', 'Actions'].map((h) => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">
                      {teachers.length === 0
                        ? 'No teachers registered yet. Click “Add Teacher” to create one.'
                        : 'No teachers match your search.'}
                    </td>
                  </tr>
                )}
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-gray-800">{t.name}</td>
                    <td className="table-cell text-gray-500">{t.email}</td>
                    <td className="table-cell">{t.department || '—'}</td>
                    <td className="table-cell">{t.subject_name || '—'}</td>
                    <td className="table-cell">
                      {t.is_homeroom ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium">
                          {t.homeroom_grade || '—'} / {t.homeroom_section || '—'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">No</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(t)} className="text-xs btn-secondary px-2 py-1">Edit</button>
                        <button onClick={() => handleDelete(t.id)} className="text-xs btn-danger px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Teacher' : 'Add Teacher'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                className="input"
                required
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                <option value="">Select department</option>
                {existingDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {existingDepartments.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No existing departments found yet. Create a subject with department first.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password {editing && '(leave blank to keep)'}
              </label>
              <input className="input" type="password" value={form.password}
                required={!editing} minLength={6}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select className="input" required value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}{subject.department ? ` (${subject.department})` : ''}
                </option>
              ))}
            </select>
            {subjects.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No subjects available yet. Create subjects first.</p>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={form.is_homeroom}
                onChange={(e) => setForm({ ...form, is_homeroom: e.target.checked })}
              />
              Mark as homeroom teacher
            </label>

            {form.is_homeroom && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Homeroom Class</label>
                  <select
                    className="input"
                    required={form.is_homeroom}
                    value={form.homeroom_class_id}
                    onChange={(e) => setHomeroomFromClass(e.target.value)}
                  >
                    <option value="">Select an existing class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        Grade {cls.grade} / Section {cls.section} {cls.academic_year ? `(${cls.academic_year})` : ''}
                      </option>
                    ))}
                  </select>
                  {classes.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No classes found. Create classes first.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade / Section</label>
                  <input
                    className="input"
                    value={form.homeroom_grade && form.homeroom_section ? `${form.homeroom_grade} / ${form.homeroom_section}` : ''}
                    readOnly
                    placeholder="Select a class above"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || subjects.length === 0 || (form.is_homeroom && classes.length === 0)}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
