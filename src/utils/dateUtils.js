// Utility function to format date as YYYY-MM-DD 
// For date-fns created dates, use toISOString to preserve the intended date
export function formatDateForAPI(date) {
  // If this is a date-fns created date (at midnight UTC), use toISOString
  // to preserve the intended date, otherwise it gets shifted by timezone
  return date.toISOString().split('T')[0]
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