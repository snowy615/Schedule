// Utility function to format date as YYYY-MM-DD in local timezone
export function formatDateForAPI(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Utility function to get today's date in YYYY-MM-DD format (local timezone)
export function getTodayDateString() {
  return formatDateForAPI(new Date())
}