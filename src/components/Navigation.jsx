import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, Clock, User, LogOut, CheckSquare, Grid3X3, List, Brain } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AITimeManagementModal from './AITimeManagementModal'
import './Navigation.css'

function Navigation() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const [showAITimeModal, setShowAITimeModal] = useState(false)

  const handleLogout = () => {
    logout()
  }

  return (
    <>
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
            to="/tasks-today" 
            className={`nav-link ${location.pathname === '/tasks-today' ? 'active' : ''}`}
          >
            <CheckSquare size={20} />
            <span>Tasks Today</span>
          </Link>
          <Link 
            to="/hour-schedule" 
            className={`nav-link ${location.pathname === '/hour-schedule' ? 'active' : ''}`}
          >
            <Grid3X3 size={20} />
            <span>Hour Schedule</span>
          </Link>
          <button 
            onClick={() => setShowAITimeModal(true)}
            className="nav-link ai-time-button"
          >
            <Brain size={20} />
            <span>AI Time Management</span>
          </button>
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
      
      {showAITimeModal && (
        <AITimeManagementModal 
          onClose={() => setShowAITimeModal(false)}
          onSave={() => {
            // Refresh the page to show updated times
            window.location.reload()
          }}
        />
      )}
    </>
  )
}

export default Navigation