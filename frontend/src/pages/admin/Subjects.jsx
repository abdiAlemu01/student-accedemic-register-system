import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';

const EMPTY = { name: '', department: '', total_mark: 100, pass_mark: 50 };

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/subjects').then(({ data }) => setSubjects(data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit   = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      department: s.department || '',
      total_mark: s.total_mark,
      pass_mark: s.pass_mark ?? 50,
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.pass_mark) > Number(form.total_mark)) {
      toast.error('Pass mark cannot be greater than total mark');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/subjects/${editing.id}`, form);
        toast.success('Subject updated');
      } else {
        await api.post('/subjects', form);
        toast.success('Subject created');
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
    if (!window.confirm('Delete this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      toast.success('Subject deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subjects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subjects.length} subjects</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Add Subject
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Subject Name</th>
                  <th className="table-header">Department</th>
                  <th className="table-header">Total Mark</th>
                  <th className="table-header">Pass Mark</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subjects.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">No subjects yet</td></tr>
                )}
                {subjects.map((s, i) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="table-cell text-gray-400">{i + 1}</td>
                    <td className="table-cell font-medium text-gray-800">{s.name}</td>
                    <td className="table-cell text-gray-600">{s.department || '—'}</td>
                    <td className="table-cell">{s.total_mark}</td>
                    <td className="table-cell">
                      <span className="badge-pass">{s.pass_mark ?? 50}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(s)} className="text-xs btn-secondary px-2 py-1">Edit</button>
                        <button onClick={() => handleDelete(s.id)} className="text-xs btn-danger px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
            <input className="input" required placeholder="e.g. Mathematics" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input className="input" placeholder="e.g. Science" value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Mark (max 100)</label>
            <input className="input" type="number" min={1} max={100} required value={form.total_mark}
              onChange={(e) => setForm({ ...form, total_mark: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pass Mark</label>
            <input className="input" type="number" min={0} max={form.total_mark || 100} required value={form.pass_mark}
              onChange={(e) => setForm({ ...form, pass_mark: Number(e.target.value) })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
