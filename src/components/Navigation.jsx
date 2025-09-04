import { Link, useLocation } from 'react-router-dom'
import { Calendar, Clock } from 'lucide-react'
import './Navigation.css'

function Navigation() {
  const location = useLocation()

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
    </nav>
  )
}

export default Navigation