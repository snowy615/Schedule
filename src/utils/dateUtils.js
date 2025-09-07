// Utility function to format date as YYYY-MM-DD 
// Always use local timezone components to avoid date shifting
export function formatDateForAPI(date) {
  // Use local timezone components to ensure the date doesn't shift
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility function to get today's date in YYYY-MM-DD format (local timezone)
export function getTodayDateString() {
  // For "today", we want the actual local date
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility function to add 24 hours (1 day) to a date and format for API
export function formatDateForAPIWithDelay(date) {
  // Create a new date object and add 24 hours (1 day)
  const delayedDate = new Date(date)
  delayedDate.setDate(delayedDate.getDate() + 1)
  
  // Use local timezone components to ensure the date doesn't shift
  const year = delayedDate.getFullYear()
  const month = String(delayedDate.getMonth() + 1).padStart(2, '0')
  const day = String(delayedDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility function to get tomorrow's date in YYYY-MM-DD format (local timezone)
export function getTomorrowDateString() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility function to safely parse a date string (YYYY-MM-DD) without timezone shifts
export function parseDateSafely(dateString) {
  if (!dateString) return new Date()
  
  // Split the date string and create date using local timezone
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day) // month is 0-indexed
}