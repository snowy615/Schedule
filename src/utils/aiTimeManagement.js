import { getTodayDateString, parseDateSafely } from './dateUtils';
import { isToday, isBefore, isAfter } from 'date-fns';

/**
 * Suggests 45-minute time blocks for tasks without user-input times
 * @param {Array} tasks - Array of task objects
 * @param {Array} plans - Array of plan objects
 * @returns {Array} - Array of tasks with suggested time blocks
 */
export async function suggestTimeBlocks(tasks, plans) {
  console.log('suggestTimeBlocks called with tasks:', tasks);
  console.log('suggestTimeBlocks called with plans:', plans);
  // Get today's date string
  const today = getTodayDateString();
  
  // Filter tasks that need time suggestions:
  // 1. Overdue tasks (incomplete tasks from previous days) - assign to today
  // 2. Today's tasks without start/finish times
  // 3. Tasks with times in the past that are incomplete - move to today
  // 4. Plan tasks without start/finish times - assign to today for overdue plans
  
  const tasksNeedingSuggestions = [];
  
  // Process regular tasks
  tasks.forEach(task => {
    try {
      console.log('Processing task:', task);
      // Skip tasks without valid IDs
      if (!task.id) {
        console.log('Skipping task without ID:', task);
        return;
      }
      
      // Check if task is overdue (incomplete and from a previous date)
      const taskDate = parseDateSafely(task.date);
      const todayDate = parseDateSafely(today);
      const isOverdue = !task.completed && isBefore(taskDate, todayDate);
      
      // Check if task is for today
      const isTaskForToday = isToday(taskDate);
      
      // Check if task has times in the past and is incomplete
      const hasPastTimes = !task.completed && task.start_time && task.finish_time && isTimeInPast(task.start_time);
      
      // Check if task lacks time information
      const hasNoTime = !task.start_time || !task.finish_time;
      
      console.log('Task analysis:', {
        id: task.id,
        title: task.title,
        date: task.date,
        isOverdue,
        isTaskForToday,
        hasPastTimes,
        hasNoTime
      });
      
      // Add to suggestions list if it's overdue, has past times, or today's task without times
      if ((isOverdue || hasPastTimes || isTaskForToday) && hasNoTime) {
        console.log('Adding task to suggestions:', task);
        tasksNeedingSuggestions.push({
          ...task,
          // For overdue tasks or tasks with past times, we'll assign times on today's date
          date: (isOverdue || hasPastTimes) ? today : task.date,
          type: 'task',
          is_overdue: isOverdue || hasPastTimes
        });
      }
      // Special case: task has times but they're in the past and task is incomplete
      else if ((isOverdue || hasPastTimes) && !hasNoTime) {
        console.log('Adding task with past times to suggestions:', task);
        tasksNeedingSuggestions.push({
          ...task,
          // Move task to today's date
          date: today,
          type: 'task',
          is_overdue: true,
          // We'll suggest new times for this task
          start_time: null,
          finish_time: null
        });
      }
    } catch (error) {
      console.warn('Error processing task:', task, error);
    }
  });
  
  // Process plan tasks
  plans.forEach(plan => {
    try {
      console.log('Processing plan:', plan);
      // Skip plans without valid IDs
      if (!plan.id) {
        console.log('Skipping plan without ID:', plan);
        return;
      }
      
      // Check if plan is for today or overdue
      const planDate = parseDateSafely(plan.date);
      const todayDate = parseDateSafely(today);
      const isPlanForToday = isToday(planDate);
      const isPlanOverdue = isBefore(planDate, todayDate);
      
      console.log('Plan analysis:', {
        id: plan.id,
        title: plan.title,
        date: plan.date,
        isPlanForToday,
        isPlanOverdue
      });
      
      if (isPlanForToday || isPlanOverdue) {
        plan.tasks.forEach(task => {
          try {
            console.log('Processing plan task:', task);
            // Skip tasks without valid IDs
            if (!task.id) {
              console.log('Skipping plan task without ID:', task);
              return;
            }
            
            // Check if task lacks time information
            const hasNoTime = !task.start_time || !task.finish_time;
            
            // Check if task has times in the past
            const hasPastTimes = task.start_time && isTimeInPast(task.start_time);
            
            console.log('Plan task analysis:', {
              id: task.id,
              title: task.title,
              hasNoTime,
              hasPastTimes
            });
            
            if (hasNoTime || hasPastTimes) {
              tasksNeedingSuggestions.push({
                ...task,
                plan_id: plan.id,
                plan_title: plan.title,
                // For overdue plans or tasks with past times, we'll assign times on today's date
                date: (isPlanOverdue || hasPastTimes) ? today : plan.date,
                type: 'plan_task',
                is_overdue: isPlanOverdue || hasPastTimes
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
  
  console.log('Tasks needing suggestions:', tasksNeedingSuggestions);
  
  // Find available time slots for today (since all tasks will be assigned to today)
  const availableSlots = findAvailableTimeSlots(tasks, plans, today);
  console.log('Available slots:', availableSlots);
  
  // Assign time blocks to tasks needing suggestions
  const tasksWithSuggestions = assignTimeBlocks(tasksNeedingSuggestions, availableSlots);
  console.log('Tasks with suggestions:', tasksWithSuggestions);
  
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
    // Get all tasks and plan tasks for the given date
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
    
    // Get current time for assigning times after current time for both overdue and today's tasks
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
    
    // Find a slot after current time for all tasks (both overdue and today's)
    for (let i = 0; i < sortedSlots.length; i++) {
      // Only consider slots that start after current time and end before 10 PM
      if (sortedSlots[i].start_time >= currentTimeString && sortedSlots[i].start_time < endTimeLimit) {
        slotIndex = i;
        currentTimeInSlot = sortedSlots[i].start_time;
        break;
      }
    }
    
    // Process all tasks (both overdue and today's) starting from current time
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