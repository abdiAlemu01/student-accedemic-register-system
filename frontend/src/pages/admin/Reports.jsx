import { useEffect, useState } from 'react';
import api from '../../api/axios';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AdminReports() {
  const [summary, setSummary]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState('');
  const [filter,  setFilter]    = useState('all'); // all | pass | fail

  useEffect(() => {
    api.get('/reports/all-students')
      .then(({ data }) => setSummary(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = summary.filter((s) => {
    const matchSearch = s.student_name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pass' ? s.overall_status === 'PASS' :
      s.overall_status === 'FAIL';
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Academic Reports</h1>
        {/* <p className="text-sm text-gray-500 mt-1">All student summaries with rank, average and pass/fail</p> */}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search student…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          {['all','pass','fail'].map((f) => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Rank</th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Grade</th>
                  <th className="table-header">Section</th>
                  <th className="table-header">Year</th>
                  <th className="table-header">Subjects</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Average</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">No data found</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.student_id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full
                                       text-xs font-bold ${
                                         s.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                         s.rank === 2 ? 'bg-gray-100 text-gray-600' :
                                         s.rank === 3 ? 'bg-orange-100 text-orange-600' :
                                         'bg-gray-50 text-gray-500'
                                       }`}>
                        {s.rank}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-gray-800">{s.student_name}</td>
                    <td className="table-cell">{s.grade}</td>
                    <td className="table-cell">{s.section}</td>
                    <td className="table-cell">{s.academic_year}</td>
                    <td className="table-cell">{s.subject_count}</td>
                    <td className="table-cell font-semibold">{s.grand_total}</td>
                    <td className="table-cell font-semibold text-blue-600">{s.average}</td>
                    <td className="table-cell">
                      <span className={s.overall_status === 'PASS' ? 'badge-pass' : 'badge-fail'}>
                        {s.overall_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary counts */}
      {!loading && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Total: <strong className="text-gray-800">{summary.length}</strong></span>
          <span>Pass: <strong className="text-green-700">{summary.filter((s) => s.overall_status === 'PASS').length}</strong></span>
          <span>Fail: <strong className="text-red-600">{summary.filter((s) => s.overall_status === 'FAIL').length}</strong></span>
        </div>
      )}
    </div>
  );
}
