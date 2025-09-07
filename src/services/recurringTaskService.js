// Service for managing recurring task generation
import apiService from './apiService'
import { calculateNextOccurrence, shouldGenerateNext } from '../utils/repeatUtils'

class RecurringTaskService {
  // Generate upcoming recurring tasks for a user
  async generateUpcomingTasks(tasks = [], daysAhead = 30) {
    const generatedTasks = []
    const currentDate = new Date()
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + daysAhead)
    
    // Find tasks that need recurring instances generated
    const recurringTasks = tasks.filter(task => 
      task.repeat_type && 
      task.repeat_type !== 'none' && 
      shouldGenerateNext(task, currentDate)
    )
    
    for (const task of recurringTasks) {
      try {
        // Check if this task needs future instances
        const existingDates = tasks
          .filter(t => t.parent_task_id === task.id || t.id === task.id)
          .map(t => new Date(t.date))
          .sort((a, b) => a - b)
        
        let lastDate = existingDates[existingDates.length - 1] || new Date(task.date)
        
        // Generate instances until we reach the maximum date or repeat_until
        while (lastDate < maxDate) {
          const nextDate = calculateNextOccurrence(lastDate, task.repeat_type)
          
          if (!nextDate) break
          
          // Check if we've exceeded the repeat_until date
          if (task.repeat_until && nextDate > new Date(task.repeat_until)) {
            break
          }
          
          // Check if this date already has an instance
          const existsAlready = tasks.some(t => 
            (t.parent_task_id === task.id || t.id === task.id) &&
            new Date(t.date).toDateString() === nextDate.toDateString()
          )
          
          if (!existsAlready) {
            // Generate the next occurrence via API
            try {
              const newTask = await apiService.generateNextOccurrence(task.id)
              if (newTask) {
                generatedTasks.push(newTask)
              }
            } catch (error) {
              console.error(`Failed to generate next occurrence for task ${task.id}:`, error)
              break
            }
          }
          
          lastDate = nextDate
        }
      } catch (error) {
        console.error(`Error processing recurring task ${task.id}:`, error)
      }
    }
    
    return generatedTasks
  }
  
  // Auto-generate recurring tasks when loading tasks
  async autoGenerateRecurringTasks(tasks) {
    try {
      const newTasks = await this.generateUpcomingTasks(tasks, 30)
      if (newTasks.length > 0) {
        console.log(`Auto-generated ${newTasks.length} recurring task instances`)
      }
      return newTasks
    } catch (error) {
      console.error('Failed to auto-generate recurring tasks:', error)
      return []
    }
  }
}

export default new RecurringTaskService()