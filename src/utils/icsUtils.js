/**
 * Utility functions for parsing .ics (iCalendar) files
 */

/**
 * Parse an .ics file content and extract events
 * @param {string} icsContent - The content of the .ics file
 * @returns {Array} Array of event objects
 */
export function parseICS(icsContent) {
  const lines = icsContent.split('\n');
  const events = [];
  let currentEvent = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);
        
        // Handle line folding (where values span multiple lines)
        let fullValue = value;
        let nextLineIndex = i + 1;
        while (nextLineIndex < lines.length && lines[nextLineIndex].startsWith(' ')) {
          fullValue += lines[nextLineIndex].substring(1); // Remove leading space
          nextLineIndex++;
          i++; // Skip the folded line
        }
        
        currentEvent[key] = fullValue;
      }
    }
  }
  
  return events.map(event => convertICSEventToTask(event));
}

/**
 * Convert an ICS event to a task object
 * @param {Object} icsEvent - The ICS event object
 * @returns {Object} Task object
 */
function convertICSEventToTask(icsEvent) {
  // Parse start date/time
  const startDate = parseICSTime(icsEvent.DTSTART);
  const endDate = parseICSTime(icsEvent.DTEND);
  
  // Extract time components if available
  let startTime = null;
  let endTime = null;
  
  if (startDate && endDate) {
    startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  }
  
  // Format date for our system (YYYY-MM-DD)
  const formattedDate = startDate ? 
    `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}` : 
    null;
  
  return {
    title: icsEvent.SUMMARY || 'Untitled Event',
    description: icsEvent.DESCRIPTION || '',
    date: formattedDate,
    start_time: startTime,
    finish_time: endTime,
    priority: 3, // Default priority
    repeat_type: 'none', // No repeat by default
    completed: false
  };
}

/**
 * Parse ICS time format
 * @param {string} icsTime - Time in ICS format (e.g., 20231015T103000Z or 20231015)
 * @returns {Date|null} Parsed Date object or null
 */
function parseICSTime(icsTime) {
  if (!icsTime) return null;
  
  // Handle date-only format (YYYYMMDD)
  if (icsTime.length === 8) {
    const year = parseInt(icsTime.substring(0, 4));
    const month = parseInt(icsTime.substring(4, 6)) - 1; // 0-indexed
    const day = parseInt(icsTime.substring(6, 8));
    return new Date(year, month, day);
  }
  
  // Handle datetime format (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
  if (icsTime.length >= 15) {
    const year = parseInt(icsTime.substring(0, 4));
    const month = parseInt(icsTime.substring(4, 6)) - 1; // 0-indexed
    const day = parseInt(icsTime.substring(6, 8));
    const hour = parseInt(icsTime.substring(9, 11));
    const minute = parseInt(icsTime.substring(11, 13));
    const second = parseInt(icsTime.substring(13, 15));
    
    // Check if it's UTC time (ends with Z)
    if (icsTime.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      return new Date(year, month, day, hour, minute, second);
    }
  }
  
  return null;
}

/**
 * Handle file upload and parse .ics content
 * @param {File} file - The uploaded .ics file
 * @returns {Promise<Array>} Promise that resolves to array of task objects
 */
export function handleICSFileUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const icsContent = event.target.result;
        const tasks = parseICS(icsContent);
        resolve(tasks);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}