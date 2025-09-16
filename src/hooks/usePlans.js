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
      // Auto-refresh after adding a plan
      window.location.reload()
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
      // Auto-refresh after deleting a plan
      window.location.reload()
      return { message: 'Plan deleted successfully' }
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
      // Auto-refresh after completing a task
      window.location.reload()
      return updatedPlan
    } catch (error) {
      console.error('Failed to complete current task:', error)
      // Check if it's a permission error
      if (error.message && error.message.includes('Insufficient permissions')) {
        alert('You do not have permission to modify this plan.')
      } else {
        alert('Failed to complete task. Please try again.')
      }
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
      // Auto-refresh after adding a task to plan
      window.location.reload()
      return updatedPlan
    } catch (error) {
      console.error('Failed to add task to plan:', error)
      // Check if it's a permission error
      if (error.message && error.message.includes('Insufficient permissions')) {
        alert('You do not have permission to modify this plan.')
      } else {
        alert('Failed to add task to plan. Please try again.')
      }
      throw error
    }
  }

  const updatePlanTask = async (planId, taskId, updates) => {
    console.log('usePlans - Updating plan task:', planId, taskId, updates);
    if (!user) {
      console.log('usePlans - No user, returning');
      return;
    }
    
    try {
      const updatedPlan = await apiService.updatePlanTask(planId, taskId, updates);
      console.log('usePlans - Plan task updated, updating state:', updatedPlan);
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? updatedPlan : plan
        )
      );
      // Auto-refresh after updating a plan task
      window.location.reload();
      return updatedPlan;
    } catch (error) {
      console.error('usePlans - Failed to update plan task:', error);
      // Check if it's a permission error
      if (error.message && error.message.includes('Insufficient permissions')) {
        alert('You do not have permission to modify this plan.');
      } else {
        alert('Failed to update task. Please try again.');
      }
      throw error;
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
      // Auto-refresh after deleting a plan task
      window.location.reload()
      return updatedPlan
    } catch (error) {
      console.error('Failed to delete plan task:', error)
      // Check if it's a permission error
      if (error.message && error.message.includes('Insufficient permissions')) {
        alert('You do not have permission to modify this plan.')
      } else {
        alert('Failed to delete task. Please try again.')
      }
      throw error
    }
  }

  // Set individual task completion status
  const setIndividualTaskStatus = async (planId, taskId, completed) => {
    if (!user) return
    
    try {
      const result = await apiService.setIndividualTaskStatus(planId, taskId, completed)
      setPlans(prev => 
        prev.map(plan => 
          plan.id === planId ? result.plan : plan
        )
      )
      // Auto-refresh after setting individual task status
      window.location.reload()
      return result
    } catch (error) {
      console.error('Failed to set individual task status:', error)
      alert('Failed to update task status. Please try again.')
      throw error
    }
  }

  // Share a plan with another user
  const sharePlan = async (planId, email, permissions = 'read') => {
    if (!user) return
    
    try {
      const result = await apiService.sharePlan(planId, email, permissions)
      // Refresh plans to show updated sharing status
      const plansData = await apiService.getPlans()
      setPlans(plansData)
      // Auto-refresh after sharing a plan
      window.location.reload()
      return result
    } catch (error) {
      console.error('Failed to share plan:', error)
      throw error
    }
  }

  // Unshare a plan with a user
  const unsharePlan = async (planId, email) => {
    if (!user) return
    
    try {
      const result = await apiService.unsharePlan(planId, email)
      // Refresh plans to show updated sharing status
      const plansData = await apiService.getPlans()
      setPlans(plansData)
      // Auto-refresh after unsharing a plan
      window.location.reload()
      return result
    } catch (error) {
      console.error('Failed to unshare plan:', error)
      throw error
    }
  }

  // Get users a plan is shared with
  const getSharedUsers = async (planId) => {
    if (!user) return []
    
    try {
      const sharedUsers = await apiService.getSharedUsers(planId)
      return sharedUsers
    } catch (error) {
      console.error('Failed to get shared users:', error)
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
    deletePlanTask,
    setIndividualTaskStatus,
    sharePlan,
    unsharePlan,
    getSharedUsers
  }
}