// Utility functions for handling task repetition logic

export const REPEAT_TYPES = {
  NONE: 'none',
  DAILY: 'daily',
  EVERY_OTHER_DAY: 'every_other_day',
  EVERY_THREE_DAYS: 'every_three_days', 
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
}

export const REPEAT_OPTIONS = [
  { value: REPEAT_TYPES.NONE, label: 'None', description: 'No repetition' },
  { value: REPEAT_TYPES.DAILY, label: 'Every day', description: 'Repeats daily' },
  { value: REPEAT_TYPES.EVERY_OTHER_DAY, label: 'Every other day', description: 'Repeats every 2 days' },
  { value: REPEAT_TYPES.EVERY_THREE_DAYS, label: 'Every 3 days', description: 'Repeats every 3 days' },
  { value: REPEAT_TYPES.WEEKLY, label: 'Every week', description: 'Repeats weekly' },
  { value: REPEAT_TYPES.MONTHLY, label: 'Every month', description: 'Repeats monthly' },
  { value: REPEAT_TYPES.YEARLY, label: 'Every year', description: 'Repeats yearly' }
]

// Calculate the next occurrence date based on repeat type
export function calculateNextOccurrence(currentDate, repeatType, interval = 1) {
  const date = new Date(currentDate)
  
  switch (repeatType) {
    case REPEAT_TYPES.DAILY:
      date.setDate(date.getDate() + interval)
      break
      
    case REPEAT_TYPES.EVERY_OTHER_DAY:
      date.setDate(date.getDate() + 2)
      break
      
    case REPEAT_TYPES.EVERY_THREE_DAYS:
      date.setDate(date.getDate() + 3)
      break
      
    case REPEAT_TYPES.WEEKLY:
      date.setDate(date.getDate() + (7 * interval))
      break
      
    case REPEAT_TYPES.MONTHLY:
      date.setMonth(date.getMonth() + interval)
      break
      
    case REPEAT_TYPES.YEARLY:
      date.setFullYear(date.getFullYear() + interval)
      break
      
    default:
      return null
  }
  
  return date
}

// Get the interval value for repeat types
export function getRepeatInterval(repeatType) {
  switch (repeatType) {
    case REPEAT_TYPES.DAILY:
      return 1
    case REPEAT_TYPES.EVERY_OTHER_DAY:
      return 2
    case REPEAT_TYPES.EVERY_THREE_DAYS:
      return 3
    case REPEAT_TYPES.WEEKLY:
      return 1
    case REPEAT_TYPES.MONTHLY:
      return 1
    case REPEAT_TYPES.YEARLY:
      return 1
    default:
      return 1
  }
}

// Check if a task should generate the next occurrence
export function shouldGenerateNext(task, currentDate = new Date()) {
  if (!task || task.repeat_type === REPEAT_TYPES.NONE) {
    return false
  }
  
  // Don't generate if task has a repeat_until date and it's past
  if (task.repeat_until) {
    const untilDate = new Date(task.repeat_until)
    if (currentDate > untilDate) {
      return false
    }
  }
  
  return true
}

// Format repeat type for display
export function formatRepeatType(repeatType) {
  const option = REPEAT_OPTIONS.find(opt => opt.value === repeatType)
  return option ? option.label : 'None'
}

// Get repeat icon for UI
export function getRepeatIcon(repeatType) {
  switch (repeatType) {
    case REPEAT_TYPES.DAILY:
    case REPEAT_TYPES.EVERY_OTHER_DAY:
    case REPEAT_TYPES.EVERY_THREE_DAYS:
      return '🔄'
    case REPEAT_TYPES.WEEKLY:
      return '📅'
    case REPEAT_TYPES.MONTHLY:
      return '📆'
    case REPEAT_TYPES.YEARLY:
      return '🗓️'
    default:
      return ''
  }
}