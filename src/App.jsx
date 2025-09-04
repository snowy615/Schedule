import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import TodayPage from './pages/TodayPage'
import Navigation from './components/Navigation'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/today" element={<TodayPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
