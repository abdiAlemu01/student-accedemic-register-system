import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const EMPTY = {
  email: '', password: '', name: '', gender: 'male',
  grade: '', section: '', academic_year: '2018', semester: 'Semester 1',
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [classes, setClasses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/students'), api.get('/classes')])
      .then(([studentsRes, classesRes]) => {
        setStudents(studentsRes.data);
        setClasses(classesRes.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

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
    const sections = Array.from(
      new Set(
        classes
          .filter((c) => String(c.grade) === String(form.grade))
          .map((c) => String(c.section))
          .filter(Boolean)
      )
    );
    return sections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [classes, form.grade]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (s) => {
    setEditing(s);
    setForm({
      email: s.email, password: '', name: s.name, gender: s.gender || 'male',
      grade: s.grade, section: s.section, academic_year: s.academic_year, semester: s.semester,
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, form);
        toast.success('Student updated');
      } else {
        await api.post('/students', form);
        toast.success('Student created');
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
    if (!window.confirm('Delete this student? This cannot be undone.')) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{students.length} registered</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Add Student
        </button>
      </div>

      {/* Search */}
      <input
        className="input max-w-sm"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name','Email','Grade','Section','Year','Semester','Gender','Actions'].map((h) => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">No students found</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium text-gray-800">{s.name}</td>
                    <td className="table-cell text-gray-500">{s.email}</td>
                    <td className="table-cell">{s.grade}</td>
                    <td className="table-cell">{s.section}</td>
                    <td className="table-cell">{s.academic_year}</td>
                    <td className="table-cell">{s.semester}</td>
                    <td className="table-cell capitalize">{s.gender}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(s)}
                          className="text-xs btn-secondary px-2 py-1">Edit</button>
                        <button onClick={() => handleDelete(s.id)}
                          className="text-xs btn-danger px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)}
             title={editing ? 'Edit Student' : 'Add New Student'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input className="input" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select className="input" value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <select
                className="input"
                required
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value, section: '' })}
              >
                <option value="">Select grade</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
                {form.grade && !gradeOptions.includes(String(form.grade)) && (
                  <option value={form.grade}>{form.grade}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                className="input"
                required
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
                disabled={!form.grade}
              >
                <option value="">{form.grade ? 'Select section' : 'Select grade first'}</option>
                {sectionOptions.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
                {form.section && !sectionOptions.includes(String(form.section)) && (
                  <option value={form.section}>{form.section}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input className="input" required value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select className="input" value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option>Semester 1</option>
                {/* <option>Semester 2</option> */}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
          {gradeOptions.length === 0 && (
            <p className="text-xs text-amber-600">No existing classes found yet. Create classes first to pick grade and section.</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
