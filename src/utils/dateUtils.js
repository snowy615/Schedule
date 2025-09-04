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