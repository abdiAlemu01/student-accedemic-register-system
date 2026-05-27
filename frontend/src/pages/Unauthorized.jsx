import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-7xl font-black text-red-200 mb-4">403</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-8">
          You don't have permission to view this page.
        </p>
        <button
          onClick={() => navigate(user ? `/${user.role}/dashboard` : '/login')}
          className="btn-primary"
        >
          Go to my dashboard
        </button>
      </div>
    </div>
  );
}
