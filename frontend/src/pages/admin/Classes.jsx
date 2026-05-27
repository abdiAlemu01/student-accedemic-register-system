import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function AdminClasses() {
  const [classes,   setClasses]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,      setForm]      = useState({ grade: '', section: '', academic_year: '2024/25' });
  const formTopRef = useRef(null);

  const normalize = (value) => String(value || '').trim().toLowerCase();

  const loadClasses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/classes');
      setClasses(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const duplicateExists = useMemo(() => {
    const grade = normalize(form.grade);
    const section = normalize(form.section);
    const year = normalize(form.academic_year);
    if (!grade || !section || !year) return false;

    return classes.some((c) =>
      c.id !== editingId &&
      normalize(c.grade) === grade &&
      normalize(c.section) === section &&
      normalize(c.academic_year) === year
    );
  }, [classes, editingId, form.grade, form.section, form.academic_year]);

  const sortedClasses = useMemo(() => {
    const parseGrade = (grade) => {
      const n = Number(String(grade).trim());
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };

    return [...classes].sort((a, b) => {
      const g = parseGrade(a.grade) - parseGrade(b.grade);
      if (g !== 0) return g;

      const ag = String(a.grade ?? '').toLowerCase();
      const bg = String(b.grade ?? '').toLowerCase();
      if (ag !== bg) return ag.localeCompare(bg);

      const sectionCmp = String(a.section ?? '').localeCompare(String(b.section ?? ''), undefined, { numeric: true, sensitivity: 'base' });
      if (sectionCmp !== 0) return sectionCmp;

      return String(a.academic_year ?? '').localeCompare(String(b.academic_year ?? ''), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes]);

  const openFormAtTop = () => {
    setShowForm(true);
    requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const createClass = async (e) => {
    e.preventDefault();

    if (duplicateExists) {
      toast.error('This class already exists for the selected academic year');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        grade: form.grade.trim(),
        section: form.section.trim(),
        academic_year: form.academic_year.trim(),
      };

      if (editingId) {
        await api.put(`/classes/${editingId}`, payload);
        toast.success('Class updated');
      } else {
        await api.post('/classes', payload);
        toast.success('Class created');
      }

      setForm({ grade: '', section: '', academic_year: '2024/25' });
      setEditingId(null);
      setShowForm(false);
      loadClasses();

    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('This class already exists');
        return;
      }
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cls) => {
    setEditingId(cls.id);
    setForm({
      grade: String(cls.grade ?? ''),
      section: String(cls.section ?? ''),
      academic_year: String(cls.academic_year ?? '2024/25'),
    });
    openFormAtTop();
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ grade: '', section: '', academic_year: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this class?')) return;
    try {
      await api.delete(`/classes/${id}`);
      toast.success('Class deleted');
      if (editingId === id) cancelForm();
      loadClasses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete class');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div ref={formTopRef} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Register Classes</h1>
        <button
          type="button"
          onClick={() => (showForm ? cancelForm() : openFormAtTop())}
          className="btn-primary self-end sm:ml-auto"
        >
          {showForm ? 'Close Form' : 'Register Class'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            {editingId ? 'Edit Class' : 'Register Class'}
          </h2>
          <form onSubmit={createClass} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <input className="input" placeholder="Enter grade" required value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                <input className="input" placeholder="Enter section" required value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input className="input" placeholder="Enter academic year" required value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })} />
            </div>
            {duplicateExists && (
              <p className="text-xs text-red-600">Class already exists with this grade, section, and academic year.</p>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn-primary flex-1">
                {creating ? (editingId ? 'Updating…' : 'Registering…') : (editingId ? 'Update Class' : 'Register Class')}
              </button>
              <button type="button" onClick={cancelForm} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
          Created Classes ({classes.length})
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Loading classes…</p>
        ) : classes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No classes created yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedClasses.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Grade {c.grade} - Section {c.section}</p>
                  <p className="text-xs text-gray-500">Academic Year: {c.academic_year}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(c)} className="text-xs btn-secondary px-2 py-1">Edit</button>
                  <button type="button" onClick={() => handleDelete(c.id)} className="text-xs btn-danger px-2 py-1">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
