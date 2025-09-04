import { createContext, useContext, useState, useEffect } from 'react'
import apiService from '../services/apiService'

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
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('auth-token')
        if (token) {
          apiService.setToken(token)
          const userData = await apiService.getCurrentUser()
          setUser(userData.user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // Clear invalid token
        apiService.logout()
      } finally {
        setLoading(false)
      }
    }
    
    checkAuth()
  }, [])

  const login = async (email, password) => {
    try {
      const data = await apiService.login(email, password)
      setUser(data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const signup = async (email, password, name) => {
    try {
      const data = await apiService.signup(email, password, name)
      setUser(data.user)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    apiService.logout()
    setUser(null)
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