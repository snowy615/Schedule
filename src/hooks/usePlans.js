import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import apiService from '../services/apiService'

export function usePlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  // Load plans from API when user changes
  useEffect(() => {
    if (!user) {
      setPlans([])
      return
    }
    
    const loadPlans = async () => {
      try {
        setLoading(true)
        const plansData = await apiService.getPlans()
        setPlans(plansData)
      } catch (error) {
        console.error('Failed to load plans:', error)
        setPlans([])
      } finally {
        setLoading(false)
      }
    }
    
    loadPlans()
  }, [user])

  const addPlan = async (newPlan) => {
    if (!user) return
    
    try {
      const plan = await apiService.createPlan(newPlan)
      setPlans(prev => [...prev, plan])
      return plan
    } catch (error) {
      console.error('Failed to add plan:', error)
      throw error
    }
  }

  const deletePlan = async (planId) => {
    if (!user) return
    
    try {
      await apiService.deletePlan(planId)
      setPlans(prev => prev.filter(plan => plan.id !== planId))
    } catch (error) {
      console.error('Failed to delete plan:', error)
      throw error
    }
  }

  const completeCurrentTask = async (planId) => {
    if (!user) return
    
    try {
      const updatedPlan = await apiService.completeCurrentTask(planId)
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? updatedPlan : plan
        )
      )
      return updatedPlan
    } catch (error) {
      console.error('Failed to complete current task:', error)
      throw error
    }
  }

  const getCurrentTask = async (planId) => {
    if (!user) return null
    
    try {
      const currentTask = await apiService.getCurrentTask(planId)
      return currentTask
    } catch (error) {
      console.error('Failed to get current task:', error)
      return null
    }
  }

  const addTaskToPlan = async (planId, taskData) => {
    if (!user) return
    
    try {
      const updatedPlan = await apiService.addTaskToPlan(planId, taskData)
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? updatedPlan : plan
        )
      )
      return updatedPlan
    } catch (error) {
      console.error('Failed to add task to plan:', error)
      throw error
    }
  }

  const updatePlanTask = async (planId, taskId, updates) => {
    if (!user) return
    
    try {
      const updatedPlan = await apiService.updatePlanTask(planId, taskId, updates)
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? updatedPlan : plan
        )
      )
      return updatedPlan
    } catch (error) {
      console.error('Failed to update plan task:', error)
      throw error
    }
  }

  const deletePlanTask = async (planId, taskId) => {
    if (!user) return
    
    try {
      const updatedPlan = await apiService.deletePlanTask(planId, taskId)
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? updatedPlan : plan
        )
      )
      return updatedPlan
    } catch (error) {
      console.error('Failed to delete plan task:', error)
      throw error
    }
  }

  return {
    plans,
    loading,
    addPlan,
    deletePlan,
    completeCurrentTask,
    getCurrentTask,
    addTaskToPlan,
    updatePlanTask,
    deletePlanTask
  }
}