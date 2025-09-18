import { getTodayDateString, parseDateSafely } from './dateUtils';
import { isToday, isBefore } from 'date-fns';

/**
 * Suggests 45-minute time blocks for tasks without user-input times
 * @param {Array} tasks - Array of task objects
 * @param {Array} plans - Array of plan objects
 * @returns {Array} - Array of tasks with suggested time blocks
 */
export async function suggestTimeBlocks(tasks, plans) {
  console.log('=== DEBUG: suggestTimeBlocks called ===');
  console.log('Total tasks received:', tasks.length);
  console.log('Total plans received:', plans.length);
  
  // Get today's date string
  const today = getTodayDateString();
  console.log('Today\'s date:', today);
  
  // Filter tasks that need time suggestions:
  // 1. Overdue tasks (incomplete tasks from previous days) - assign to today
  // 2. Today's tasks without start/finish times
  // 3. Plan tasks without start/finish times from today's or overdue plans
  
  const tasksNeedingSuggestions = [];
  
  // Process regular tasks - only incomplete tasks that need time assignment
  tasks.forEach(task => {
    try {
      // Skip tasks without valid IDs
      if (!task.id) {
        return;
      }
      
      // Skip completed tasks
      if (task.completed) {
        return;
      }
      
      // Check if task is overdue (incomplete and from a previous date)
      const taskDate = parseDateSafely(task.date);
      const todayDate = parseDateSafely(today);
      const isOverdue = isBefore(taskDate, todayDate);
      
      // Check if task is for today
      const isTaskForToday = isToday(taskDate);
      
      // Check if task lacks time information
      const hasNoTime = !task.start_time || !task.finish_time;
      
      // Only add tasks that are either overdue or for today AND have no time
      if ((isOverdue || isTaskForToday) && hasNoTime) {
        tasksNeedingSuggestions.push({
          ...task,
          // For overdue tasks, we'll assign times on today's date
          date: isOverdue ? today : task.date,
          type: 'task',
          is_overdue: isOverdue
        });
      }
    } catch (error) {
      console.warn('Error processing task:', task, error);
    }
  });
  
  console.log('Regular tasks needing suggestions:', tasksNeedingSuggestions.length);
  
  // Process plan tasks - only from plans that are for today or overdue
  plans.forEach(plan => {
    try {
      // Skip plans without valid IDs
      if (!plan.id) {
        return;
      }
      
      // Check if plan is for today or overdue
      const planDate = parseDateSafely(plan.date);
      const todayDate = parseDateSafely(today);
      const isPlanForToday = isToday(planDate);
      const isPlanOverdue = isBefore(planDate, todayDate);
      
      // Only process plan tasks if the plan is for today or overdue
      if (isPlanForToday || isPlanOverdue) {
        plan.tasks.forEach(task => {
          try {
            // Skip tasks without valid IDs
            if (!task.id) {
              return;
            }
            
            // Skip completed tasks
            if (task.completed) {
              return;
            }
            
            // Check if task lacks time information
            const hasNoTime = !task.start_time || !task.finish_time;
            
            // Only add plan tasks that need time suggestions
            if (hasNoTime) {
              tasksNeedingSuggestions.push({
                ...task,
                plan_id: plan.id,
                plan_title: plan.title,
                // For overdue plans, we'll assign times on today's date
                date: isPlanOverdue ? today : plan.date,
                type: 'plan_task',
                is_overdue: isPlanOverdue
              });
            }
          } catch (error) {
            console.warn('Error processing plan task:', task, error);
          }
        });
      }
    } catch (error) {
      console.warn('Error processing plan:', plan, error);
    }
  });
  
  console.log('Total tasks needing suggestions (including plan tasks):', tasksNeedingSuggestions.length);
  
  // Filter out duplicates and ensure we only have unique tasks
  const uniqueTasks = [];
  const taskIds = new Set();
  
  tasksNeedingSuggestions.forEach(task => {
    const uniqueId = task.type === 'plan_task' ? `plan_${task.plan_id}_task_${task.id}` : `task_${task.id}`;
    if (!taskIds.has(uniqueId)) {
      taskIds.add(uniqueId);
      uniqueTasks.push(task);
    }
  });
  
  console.log('Unique tasks needing suggestions:', uniqueTasks.length);
  
  // Find available time slots for today
  const availableSlots = findAvailableTimeSlots(tasks, plans, today);
  console.log('Available slots:', availableSlots);
  
  // Assign time blocks to tasks needing suggestions
  const tasksWithSuggestions = assignTimeBlocks(uniqueTasks, availableSlots);
  console.log('Final tasks with suggestions:', tasksWithSuggestions.length);
  
  return tasksWithSuggestions;
}

/**
 * Checks if a time is in the past relative to current time
 * @param {string} time - Time string in HH:MM format
 * @returns {boolean} - True if time is in the past
 */
function isTimeInPast(time) {
  const now = new Date();
  const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return time < currentTimeString;
}

/**
 * Finds available time slots for a given date
 * @param {Array} tasks - Array of task objects
 * @param {Array} plans - Array of plan objects
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Array} - Array of available time slots
 */
function findAvailableTimeSlots(tasks, plans, date) {
  try {
    // Get all tasks and plan tasks for the given date that already have times
    const scheduledItems = [];
    
    // Collect scheduled tasks for the date
    tasks.forEach(task => {
      try {
        if (task.date === date && task.start_time && task.finish_time) {
          scheduledItems.push({
            start_time: task.start_time,
            finish_time: task.finish_time
          });
        }
      } catch (error) {
        console.warn('Error processing task for scheduling:', task, error);
      }
    });
    
    // Collect scheduled plan tasks for the date
    plans.forEach(plan => {
      try {
        if (plan.date === date) {
          plan.tasks.forEach(task => {
            try {
              if (task.start_time && task.finish_time) {
                scheduledItems.push({
                  start_time: task.start_time,
                  finish_time: task.finish_time
                });
              }
            } catch (error) {
              console.warn('Error processing plan task for scheduling:', task, error);
            }
          });
        }
      } catch (error) {
        console.warn('Error processing plan for scheduling:', plan, error);
      }
    });
    
    // Sort scheduled items by start time
    scheduledItems.sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    // Define reasonable working hours (8 AM to 10 PM)
    const workStart = '08:00';
    const workEnd = '22:00';
    
    // Find available slots
    const availableSlots = [];
    let currentTime = workStart;
    
    // Check each scheduled item for gaps
    for (const item of scheduledItems) {
      // If there's a gap between current time and item start time
      if (currentTime < item.start_time) {
        availableSlots.push({
          start_time: currentTime,
          finish_time: item.start_time
        });
      }
      
      // Update current time to after this item
      if (item.finish_time > currentTime) {
        currentTime = item.finish_time;
      }
    }
    
    // Add final slot from last item to end of work day
    if (currentTime < workEnd) {
      availableSlots.push({
        start_time: currentTime,
        finish_time: workEnd
      });
    }
    
    // Filter out slots that are too short for a 45-minute block
    return availableSlots.filter(slot => {
      const slotDuration = timeToMinutes(slot.finish_time) - timeToMinutes(slot.start_time);
      return slotDuration >= 45;
    });
  } catch (error) {
    console.error('Error finding available time slots:', error);
    return []; // Return empty array if there's an error
  }
}

/**
 * Assigns 45-minute time blocks to tasks from available slots
 * @param {Array} tasks - Array of tasks needing time suggestions
 * @param {Array} availableSlots - Array of available time slots
 * @returns {Array} - Array of tasks with assigned time blocks
 */
function assignTimeBlocks(tasks, availableSlots) {
  try {
    // Sort slots by start time
    const sortedSlots = [...availableSlots].sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    // Assign time blocks to tasks
    const tasksWithSuggestions = [];
    
    // Get current time for assigning times after current time
    const now = new Date();
    const currentTimeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Define the end time limit (10 PM)
    const endTimeLimit = '22:00';
    
    // If current time is already past the end time limit, no suggestions can be made
    if (currentTimeString >= endTimeLimit) {
      console.log('Current time is past 10 PM, no time slots available for suggestions');
      return tasks.map(task => ({
        ...task,
        suggested_start_time: null,
        suggested_finish_time: null
      }));
    }
    
    // Find the first available slot that starts after current time
    let slotIndex = 0;
    let currentTimeInSlot = sortedSlots.length > 0 ? sortedSlots[0].start_time : '08:00';
    
    // Find a slot after current time
    for (let i = 0; i < sortedSlots.length; i++) {
      if (sortedSlots[i].start_time >= currentTimeString && sortedSlots[i].start_time < endTimeLimit) {
        slotIndex = i;
        currentTimeInSlot = sortedSlots[i].start_time;
        break;
      }
    }
    
    // Process all tasks starting from current time
    tasks.forEach(task => {
      try {
        // Find a suitable 45-minute slot
        let assigned = false;
        let tempSlotIndex = slotIndex;
        let tempCurrentTimeInSlot = currentTimeInSlot;
        
        while (tempSlotIndex < sortedSlots.length && !assigned) {
          const slot = sortedSlots[tempSlotIndex];
          
          // Calculate end time for 45-minute block
          const endTime = addMinutesToTime(tempCurrentTimeInSlot, 45);
          
          // Check if the 45-minute block fits in the current slot AND doesn't go beyond 10 PM
          if (endTime <= slot.finish_time && endTime <= endTimeLimit && tempCurrentTimeInSlot >= currentTimeString) {
            tasksWithSuggestions.push({
              ...task,
              suggested_start_time: tempCurrentTimeInSlot,
              suggested_finish_time: endTime
            });
            
            // Move current time to after this block for next task
            if (tempSlotIndex === slotIndex) {
              currentTimeInSlot = endTime;
            }
            assigned = true;
          } else {
            // Move to next slot
            tempSlotIndex++;
            if (tempSlotIndex < sortedSlots.length) {
              tempCurrentTimeInSlot = sortedSlots[tempSlotIndex].start_time;
            }
          }
        }
        
        // If we couldn't find a slot, add task without suggestion
        if (!assigned) {
          tasksWithSuggestions.push({
            ...task,
            suggested_start_time: null,
            suggested_finish_time: null
          });
        }
      } catch (error) {
        console.warn('Error assigning time block to task:', task, error);
        // Add task without suggestion if there's an error
        tasksWithSuggestions.push({
          ...task,
          suggested_start_time: null,
          suggested_finish_time: null
        });
      }
    });
    
    return tasksWithSuggestions;
  } catch (error) {
    console.error('Error assigning time blocks:', error);
    // Return tasks without suggestions if there's an error
    return tasks.map(task => ({
      ...task,
      suggested_start_time: null,
      suggested_finish_time: null
    }));
  }
}

/**
 * Converts time string (HH:MM) to minutes since midnight
 * @param {string} time - Time string in HH:MM format
 * @returns {number} - Minutes since midnight
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Adds minutes to a time string (HH:MM format)
 * @param {string} time - Time string in HH:MM format
 * @param {number} minutes - Number of minutes to add
 * @returns {string} - New time string in HH:MM format
 */
function addMinutesToTime(time, minutes) {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}