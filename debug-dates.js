// Debug script to test date handling
const { format, eachDayOfInterval, startOfMonth, endOfMonth } = require('date-fns');

// Simulate what happens in the calendar
const currentDate = new Date(2025, 8, 4); // September 4, 2025
console.log('Current date:', currentDate);
console.log('Current date formatted:', format(currentDate, 'yyyy-MM-dd'));

const monthStart = startOfMonth(currentDate);
const monthEnd = endOfMonth(currentDate);
const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

// Find Sept 4 in the days array
const sept4 = daysInMonth.find(day => format(day, 'd') === '4');
console.log('Sept 4 from date-fns:', sept4);
console.log('Sept 4 toString:', sept4.toString());
console.log('Sept 4 toISOString():', sept4.toISOString());
console.log('Sept 4 toISOString().split("T")[0]:', sept4.toISOString().split('T')[0]);

// Test local date components
console.log('Sept 4 getDate():', sept4.getDate());
console.log('Sept 4 getMonth():', sept4.getMonth());
console.log('Sept 4 getFullYear():', sept4.getFullYear());

// Test what our current utility does
const formatDateForAPI = (date) => {
  return date.toISOString().split('T')[0];
};

console.log('formatDateForAPI result:', formatDateForAPI(sept4));