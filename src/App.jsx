import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import HomePage from './pages/HomePage'
import TasksTodayPage from './pages/TasksTodayPage'
import TodayHourSchedulePage from './pages/TodayHourSchedulePage'
import Navigation from './components/Navigation'
import AuthPage from './components/AuthPage'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="app">
      <Navigation />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks-today" element={<TasksTodayPage />} />
          <Route path="/hour-schedule" element={<TodayHourSchedulePage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App

// Test comment to verify git tracking
// comment testing if change is reflected. None seen.