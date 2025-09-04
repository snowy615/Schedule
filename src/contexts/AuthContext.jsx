import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for existing user session on mount
  useEffect(() => {
    // Create demo user if no users exist
    const users = JSON.parse(localStorage.getItem('schedule-users') || '[]')
    if (users.length === 0) {
      const demoUser = {
        id: 'demo-user',
        email: 'demo@example.com',
        password: 'demo123',
        name: 'Demo User',
        createdAt: new Date().toISOString()
      }
      localStorage.setItem('schedule-users', JSON.stringify([demoUser]))
    }
    
    const savedUser = localStorage.getItem('schedule-user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    try {
      // Simulate API call - in a real app, this would call your backend
      const users = JSON.parse(localStorage.getItem('schedule-users') || '[]')
      const user = users.find(u => u.email === email && u.password === password)
      
      if (!user) {
        throw new Error('Invalid email or password')
      }

      setUser(user)
      localStorage.setItem('schedule-user', JSON.stringify(user))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const signup = async (email, password, name) => {
    try {
      // Simulate API call - in a real app, this would call your backend
      const users = JSON.parse(localStorage.getItem('schedule-users') || '[]')
      
      // Check if user already exists
      if (users.some(u => u.email === email)) {
        throw new Error('User with this email already exists')
      }

      const newUser = {
        id: Date.now().toString(),
        email,
        password, // In a real app, this would be hashed
        name,
        createdAt: new Date().toISOString()
      }

      users.push(newUser)
      localStorage.setItem('schedule-users', JSON.stringify(users))
      
      setUser(newUser)
      localStorage.setItem('schedule-user', JSON.stringify(newUser))
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('schedule-user')
  }

  const value = {
    user,
    login,
    signup,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}