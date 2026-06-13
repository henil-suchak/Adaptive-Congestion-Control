import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthService } from '../services/api';

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = AuthService.isAuthenticated();
  const username = AuthService.getUsername();

  const linkClass = (path) => `px-4 py-2 rounded-md text-sm font-medium transition ${
    location.pathname === path ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-gray-200'
  }`;

  const handleLogout = () => {
    AuthService.logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-gray-900">Adaptive CC Platform</h1>
      
      <div className="flex items-center space-x-2">
        <Link to="/" className={linkClass('/')}>Home</Link>
        
        {isAuthenticated && (
          <>
            <Link to="/arena" className={linkClass('/arena')}>Inference Arena</Link>
            <Link to="/lab" className={linkClass('/lab')}>Training Lab</Link>
            <Link to="/topology" className={linkClass('/topology')}>Topology Builder</Link>
          </>
        )}

        {isAuthenticated ? (
          <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200">
            <span className="text-sm text-gray-600">
              👤 <span className="font-medium text-gray-800">{username}</span>
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition"
            >
              Logout
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="ml-4 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition"
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}