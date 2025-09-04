import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const { user } = useAuth()

  // Get the storage key for the current user
  const getStorageKey = () => {
    return user ? `schedule-tasks-${user.id}` : 'schedule-tasks-guest'
  }

  // Load tasks from localStorage on mount or when user changes
  useEffect(() => {
    if (!user) {
      setTasks([])
      return
    }
    
    const storageKey = getStorageKey()
    const savedTasks = localStorage.getItem(storageKey)
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks))
    } else {
      setTasks([])
    }
  }, [user])

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    if (user) {
      const storageKey = getStorageKey()
      localStorage.setItem(storageKey, JSON.stringify(tasks))
    }
  }, [tasks, user])

  const addTask = (newTask) => {
    if (!user) return
    setTasks(prev => [...prev, newTask])
  }

  const toggleTask = (taskId) => {
    if (!user) return
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      )
    )
  }

  const deleteTask = (taskId) => {
    if (!user) return
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  const updateTask = (taskId, updates) => {
    if (!user) return
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, ...updates }
          : task
      )
    )
  }

  return {
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    updateTask
  }
}