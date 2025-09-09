import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import HomePage from './pages/HomePage';
import TasksTodayPage from './pages/TasksTodayPage';
import TodayHourSchedulePage from './pages/TodayHourSchedulePage';
import Navigation from './components/Navigation';
import { useAuth } from './contexts/AuthContext';
import './App.css';

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="app">
      {user && <Navigation />}
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/today" element={<TasksTodayPage />} />
        <Route path="/hour-schedule" element={<TodayHourSchedulePage />} />
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;