import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import apiService from '../services/apiService'

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  
  // Load tasks from API when user changes
  useEffect(() => {
    if (!user) {
      setTasks([])
      return
    }
    
    const loadTasks = async () => {
      try {
        setLoading(true)
        const tasksData = await apiService.getTasks()
        setTasks(tasksData)
      } catch (error) {
        console.error('Failed to load tasks:', error)
        setTasks([])
      } finally {
        setLoading(false)
      }
    }
    
    loadTasks()
  }, [user])

  const addTask = async (newTask) => {
    if (!user) return
    
    try {
      const task = await apiService.createTask(newTask)
      setTasks(prev => [...prev, task])
      return task
    } catch (error) {
      console.error('Failed to add task:', error)
      throw error
    }
  }

  const toggleTask = async (taskId) => {
    if (!user) return
    
    try {
      const updatedTask = await apiService.toggleTask(taskId)
      
      // Update the specific task
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? updatedTask : task
        )
      )
      
      // If a recurring task was just completed, reload tasks to get any newly generated next occurrence
      if (updatedTask.completed && 
          updatedTask.repeat_type && 
          updatedTask.repeat_type !== 'none') {
        // Small delay to ensure the next occurrence has been created
        setTimeout(async () => {
          try {
            const refreshedTasks = await apiService.getTasks()
            setTasks(refreshedTasks)
          } catch (error) {
            console.error('Failed to refresh tasks after recurring task completion:', error)
          }
        }, 500)
      }
      
      return updatedTask
    } catch (error) {
      console.error('Failed to toggle task:', error)
      throw error
    }
  }

  const deleteTask = async (taskId) => {
    if (!user) return
    
    try {
      await apiService.deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
      throw error
    }
  }

  const updateTask = async (taskId, updates) => {
    if (!user) return
    
    try {
      const updatedTask = await apiService.updateTask(taskId, updates)
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? updatedTask : task
        )
      )
      return updatedTask
    } catch (error) {
      console.error('Failed to update task:', error)
      throw error
    }
  }

  const generateNextOccurrence = async (taskId) => {
    if (!user) return
    
    try {
      const newTask = await apiService.generateNextOccurrence(taskId)
      setTasks(prev => [...prev, newTask])
      return newTask
    } catch (error) {
      console.error('Failed to generate next occurrence:', error)
      throw error
    }
  }

  return {
    tasks,
    loading,
    addTask,
    toggleTask,
    deleteTask,
    updateTask,
    generateNextOccurrence
  }
}