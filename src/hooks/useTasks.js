import { useState, useEffect } from 'react'

export function useTasks() {
  const [tasks, setTasks] = useState([])

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('schedule-tasks')
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks))
    }
  }, [])

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    localStorage.setItem('schedule-tasks', JSON.stringify(tasks))
  }, [tasks])

  const addTask = (newTask) => {
    setTasks(prev => [...prev, newTask])
  }

  const toggleTask = (taskId) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, completed: !task.completed }
          : task
      )
    )
  }

  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  const updateTask = (taskId, updates) => {
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