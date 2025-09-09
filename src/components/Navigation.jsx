import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, Calendar, List, Clock } from 'lucide-react';
import './Navigation.css';

function Navigation() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!user) return null;

  return (
    <nav className="navigation">
      <div className="nav-left">
        <Link 
          to="/" 
          className={location.pathname === '/' ? 'active' : ''}
        >
          <Calendar size={20} />
          <span>Calendar</span>
        </Link>
        <Link 
          to="/today" 
          className={location.pathname === '/today' ? 'active' : ''}
        >
          <List size={20} />
          <span>Tasks Today</span>
        </Link>
        <Link 
          to="/hour-schedule" 
          className={location.pathname === '/hour-schedule' ? 'active' : ''}
        >
          <Clock size={20} />
          <span>Hour Schedule</span>
        </Link>
        <button onClick={handleRefresh} className="refresh-button" title="Refresh Page">
          <span>🔄</span>
        </button>
      </div>
      <div className="nav-right">
        <span className="user-email">{user.email}</span>
        <button onClick={handleLogout} className="logout-button">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </nav>
  );
}

export default Navigation;