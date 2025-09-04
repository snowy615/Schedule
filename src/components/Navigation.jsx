import { Link, useLocation } from 'react-router-dom'
import { Calendar, Clock, User, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import './Navigation.css'

function Navigation() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <h1>Schedule</h1>
      </div>
      <div className="nav-links">
        <Link 
          to="/" 
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <Calendar size={20} />
          <span>Calendar</span>
        </Link>
        <Link 
          to="/today" 
          className={`nav-link ${location.pathname === '/today' ? 'active' : ''}`}
        >
          <Clock size={20} />
          <span>Today</span>
        </Link>
      </div>
      <div className="nav-user">
        <div className="user-info">
          <User size={18} />
          <span>{user?.name || user?.email}</span>
        </div>
        <button onClick={handleLogout} className="logout-button">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  )
}

export default Navigation