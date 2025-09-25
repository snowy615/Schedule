import React, { useState, useRef, useCallback } from 'react'
import { format, isToday } from 'date-fns'
import { Plus, Clock, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { getTodayDateString, getTomorrowDateString, parseDateSafely } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatRepeatType, getRepeatIcon } from '../utils/repeatUtils'
import { handleICSFileUpload } from '../utils/icsUtils'
import './TodayHourSchedulePage.css'

function TodayHourSchedulePage() {
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [isEarlyHoursExpanded, setIsEarlyHoursExpanded] = useState(false)
  const [isLateHoursExpanded, setIsLateHoursExpanded] = useState(false)
  const [hoveredTask, setHoveredTask] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [editingTask, setEditingTask] = useState(null)
  const [dragState, setDragState] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)
  const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTasks()
  const today = new Date()

  const todayTasks = tasks
    .filter(task => {
      // Validate task object
      if (!task || typeof task !== 'object' || !task.date) {
        return false;
      }
      
      try {
        return isToday(parseDateSafely(task.date));
      } catch (error) {
        console.error('Error filtering tasks by date:', error);
        return false;
      }
    })
    .sort((a, b) => {
      try {
        // Validate task objects
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return 0;
        
        // Validate time fields
        const aHasValidStart = a.start_time && typeof a.start_time === 'string' && /^\d{2}:\d{2}$/.test(a.start_time);
        const bHasValidStart = b.start_time && typeof b.start_time === 'string' && /^\d{2}:\d{2}$/.test(b.start_time);
        const aHasValidFinish = a.finish_time && typeof a.finish_time === 'string' && /^\d{2}:\d{2}$/.test(a.finish_time);
        const bHasValidFinish = b.finish_time && typeof b.finish_time === 'string' && /^\d{2}:\d{2}$/.test(b.finish_time);
        
        // Sort by start_time first, then by finish_time, then by creation time
        if (!aHasValidStart && !bHasValidStart) return 0;
        if (!aHasValidStart) return 1;
        if (!bHasValidStart) return -1;
        
        const startTimeComparison = a.start_time.localeCompare(b.start_time);
        if (startTimeComparison !== 0) return startTimeComparison;
        
        // If start times are equal, sort by finish time
        if (!aHasValidFinish && !bHasValidFinish) return 0;
        if (!aHasValidFinish) return 1;
        if (!bHasValidFinish) return -1;
        return a.finish_time.localeCompare(b.finish_time);
      } catch (error) {
        console.error('Error sorting tasks:', error);
        return 0;
      }
    })

  const handleAddTask = async (taskData) => {
    try {
      await addTask({
        ...taskData,
        date: getTodayDateString() // Use today's date instead of tomorrow's
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setShowTaskModal(true)
  }

  const handleSaveTask = async (taskIdOrData, updateData = null) => {
    try {
      if (editingTask && updateData) {
        // This is an edit operation
        await updateTask(taskIdOrData, updateData)
        setEditingTask(null)
      } else {
        // This is an add operation
        await addTask({
          ...taskIdOrData,
          date: getTodayDateString() // Use today's date instead of tomorrow's
        })
      }
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to save task:', error)
      // Could add error handling UI here
    }
  }

  const handleCloseTaskModal = () => {
    setShowTaskModal(false)
    setEditingTask(null)
  }

  // Generate hour slots from 12 AM to 11 PM (24 hours)
  const generateHourSlots = () => {
    try {
      const slots = []
      for (let hour = 0; hour < 24; hour++) {
        const timeString = `${hour.toString().padStart(2, '0')}:00`
        const displayTime = formatTime(timeString)
        const isEarlyHour = hour >= 0 && hour <= 5 // 12 AM to 5 AM
        const isLateHour = hour >= 22 && hour <= 23 // 10 PM to 11 PM
        
        slots.push({
          hour,
          timeString,
          displayTime,
          tasks: getTasksForHour(hour),
          isEarlyHour,
          isLateHour
        })
      }
      return slots
    } catch (error) {
      console.error('Error generating hour slots:', error)
      return []
    }
  }

  const formatTime = (time) => {
    try {
      // Validate input
      if (!time || typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
        return 'Invalid Time';
      }
      
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minutes} ${ampm}`
    } catch (error) {
      console.error('Error formatting time:', error)
      return 'Error'
    }
  }

  const getTasksForHour = (hour) => {
    try {
      // Validate hour parameter
      if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        return [];
      }
      
      return getTasksSpanningHour(hour)
    } catch (error) {
      console.error('Error getting tasks for hour:', error)
      return []
    }
  }

  // Get tasks that span through a specific hour (including partial overlaps)
  const getTasksSpanningHour = (hour) => {
    return todayTasks.filter(task => {
      // Validate task has required properties
      if (!task || typeof task !== 'object') {
        return false;
      }
      
      // Validate time fields exist and are strings
      if ((!task.start_time || typeof task.start_time !== 'string') && 
          (!task.finish_time || typeof task.finish_time !== 'string')) {
        // For tasks without end time, only show in start hour
        if (!task.start_time || typeof task.start_time !== 'string') return false
        const taskHour = parseInt(task.start_time.split(':')[0])
        return !isNaN(taskHour) && taskHour === hour
      }
      
      // Validate time format
      if (task.start_time && !/^\d{2}:\d{2}$/.test(task.start_time)) {
        return false;
      }
      
      if (task.finish_time && !/^\d{2}:\d{2}$/.test(task.finish_time)) {
        return false;
      }
      
      if (!task.start_time || !task.finish_time) {
        // For tasks without end time, only show in start hour
        if (!task.start_time) return false
        const taskHour = parseInt(task.start_time.split(':')[0])
        return !isNaN(taskHour) && taskHour === hour
      }
      
      const [startHour, startMin] = task.start_time.split(':').map(Number)
      const [endHour, endMin] = task.finish_time.split(':').map(Number)
      
      // Validate parsed time values
      if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin) ||
          startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
          endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
        return false;
      }
      
      const taskStartTime = startHour + startMin / 60
      const taskEndTime = endHour + endMin / 60
      
      // Calculate hour boundaries
      const hourStart = hour
      const hourEnd = hour + 1
      
      // A task spans this hour if:
      // 1. It starts before this hour ends (taskStartTime < hourEnd)
      // 2. It ends after this hour starts (taskEndTime > hourStart)
      if (taskStartTime < hourEnd && taskEndTime > hourStart) {
        // Special case for precise boundary handling:
        // If a task ends exactly at an hour boundary (e.g., 8:00),
        // it should NOT appear in the next hour (8:00-9:00)
        // but should appear in the current hour (7:00-8:00)
        if (taskEndTime === hourEnd && endMin === 0) {
          // Only show in hours that are before the end time
          return taskStartTime < hourEnd && taskEndTime > hourStart && hour < endHour
        }
        return true
      }
      
      return false
    })
  }

  // Calculate task positioning within hour slots
  const getTaskPositioning = (task, hour) => {
    // Use current drag times if this task is being dragged
    const isTaskBeingDragged = dragState && dragState.task.id === task.id;
    const startTime = isTaskBeingDragged ? 
      (dragState.currentStartTime || task.start_time) : task.start_time;
    const finishTime = isTaskBeingDragged ? 
      (dragState.currentFinishTime || task.finish_time) : task.finish_time;
    
    // Handle case where task times might be undefined
    if (!startTime || !finishTime) {
      // For tasks without proper time, show them at the top of the hour
      return {
        top: 0,
        height: 100, // Full height for tasks without proper time
        startOffset: 0,
        endOffset: 0,
        isFirstHour: true,
        isLastHour: true,
        isSingleHour: true
      }
    }
    
    // Validate time format before parsing
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(finishTime)) {
      // Invalid time format, show at top with full height
      return {
        top: 0,
        height: 100,
        startOffset: 0,
        endOffset: 0,
        isFirstHour: true,
        isLastHour: true,
        isSingleHour: true
      }
    }
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = finishTime.split(':').map(Number)
    
    // Validate time values
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin) ||
        startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
        endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
      // Invalid time values, show at top with full height
      return {
        top: 0,
        height: 100,
        startOffset: 0,
        endOffset: 0,
        isFirstHour: true,
        isLastHour: true,
        isSingleHour: true
      }
    }
    
    const taskStartTime = startHour + startMin / 60
    const taskEndTime = endHour + endMin / 60
    
    // Calculate position within this hour slot
    const hourStart = hour
    const hourEnd = hour + 1
    
    // Find the overlap with this hour
    const overlapStart = Math.max(taskStartTime, hourStart)
    const overlapEnd = Math.min(taskEndTime, hourEnd)
    
    // Convert to percentage of the hour (0-100%)
    const startPercent = ((overlapStart - hourStart) / 1) * 100
    const heightPercent = ((overlapEnd - overlapStart) / 1) * 100
    
    // Determine if this is the first, last, or middle hour of the task
    const isFirstHour = hour === startHour
    let isLastHour = (hour === endHour && endMin > 0) || (hour === endHour - 1 && endMin === 0)
    
    // Special case: if task ends exactly at hour boundary, this hour is the last hour
    const endsAtBoundary = taskEndTime === hourEnd && endMin === 0
    if (endsAtBoundary) {
      isLastHour = hour < endHour // Only true if this hour is before the end hour
    }
    
    const isSingleHour = Math.floor(taskStartTime) === Math.floor(taskEndTime) && 
                         (Math.floor(taskStartTime) === hour || Math.floor(taskEndTime) === hour)
    
    return {
      top: startPercent,
      height: heightPercent,
      startOffset: startPercent,
      endOffset: 100 - (startPercent + heightPercent),
      isFirstHour,
      isLastHour,
      isSingleHour,
      isMiddleHour: !isFirstHour && !isLastHour
    }
  }

  const getTaskDuration = (startTime, endTime) => {
    // Validate inputs
    if (!startTime || !endTime || typeof startTime !== 'string' || typeof endTime !== 'string') {
      return 1; // Default duration if no valid end time
    }
    
    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return 1; // Default duration if invalid format
    }
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    // Validate parsed values
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin) ||
        startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
        endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
      return 1; // Default duration if invalid values
    }
    
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    
    return Math.max(1, Math.ceil((endTotal - startTotal) / 60)) // At least 1 hour
  }

  // Drag-to-adjust functionality
  const startDrag = useCallback((task, hour, dragType, e) => {
    // Validate inputs
    if (!task || !e || !dragType) return;
    
    e.stopPropagation();
    
    // Prevent drag on completed tasks
    if (task.completed) return;
    
    // Only allow dragging for top/bottom handles (time adjustment), not for moving tasks
    if (dragType === 'move') return;
    
    // Validate task times
    if (!task.start_time || !task.finish_time) return;
    
    // Validate time format
    if (!/^\d{2}:\d{2}$/.test(task.start_time) || !/^\d{2}:\d{2}$/.test(task.finish_time)) {
      return;
    }
    
    const hourSlot = document.querySelector(`.hour-slot[data-hour="${hour}"] .tasks-column`);
    if (!hourSlot) return;
    
    const rect = hourSlot.getBoundingClientRect();
    const hourHeight = rect.height;
    const pixelsPerMinute = hourHeight / 60; // 60 minutes per hour
    
    setDragState({
      task,
      dragType, // 'top' or 'bottom' only
      hour,
      initialY: e.clientY,
      hourSlotTop: rect.top,
      hourSlotHeight: hourHeight,
      pixelsPerMinute,
      originalStartTime: task.start_time,
      originalFinishTime: task.finish_time
    });
    
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((e) => {
    if (!dragState || !isDragging || !e) return;
    
    // Use requestAnimationFrame to throttle updates for better performance
    requestAnimationFrame(() => {
      const { 
        task, 
        dragType, 
        hour, 
        hourSlotTop, 
        hourSlotHeight, 
        pixelsPerMinute,
        originalStartTime,
        originalFinishTime
      } = dragState;
      
      // Validate required data
      if (!originalStartTime || !originalFinishTime) return;
      
      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(originalStartTime) || !/^\d{2}:\d{2}$/.test(originalFinishTime)) {
        return;
      }
      
      const currentY = e.clientY;
      const deltaY = currentY - dragState.initialY;
      const minutesDelta = Math.round(deltaY / pixelsPerMinute);
      
      // Parse original times
      const [startHour, startMin] = originalStartTime.split(':').map(Number);
      const [finishHour, finishMin] = originalFinishTime.split(':').map(Number);
      
      // Validate parsed values
      if (isNaN(startHour) || isNaN(startMin) || isNaN(finishHour) || isNaN(finishMin) ||
          startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
          finishHour < 0 || finishHour > 23 || finishMin < 0 || finishMin > 59) {
        return;
      }
      
      let newStartTime = originalStartTime;
      let newFinishTime = originalFinishTime;
      
      if (dragType === 'top') {
        // Adjust start time
        let totalStartMinutes = startHour * 60 + startMin + minutesDelta;
        // Ensure start time doesn't go past finish time (minimum 5 minutes)
        const finishTotalMinutes = finishHour * 60 + finishMin;
        totalStartMinutes = Math.min(totalStartMinutes, finishTotalMinutes - 5);
        
        // Ensure start time doesn't go before 12 AM
        totalStartMinutes = Math.max(totalStartMinutes, 0);
        
        const newStartHour = Math.floor(totalStartMinutes / 60);
        const newStartMin = totalStartMinutes % 60;
        newStartTime = `${String(newStartHour).padStart(2, '0')}:${String(newStartMin).padStart(2, '0')}`;
      } else if (dragType === 'bottom') {
        // Adjust finish time
        let totalFinishMinutes = finishHour * 60 + finishMin + minutesDelta;
        // Ensure finish time doesn't go before start time (minimum 5 minutes)
        const startTotalMinutes = startHour * 60 + startMin;
        totalFinishMinutes = Math.max(totalFinishMinutes, startTotalMinutes + 5);
        
        // Ensure finish time doesn't go past 11:59 PM
        totalFinishMinutes = Math.min(totalFinishMinutes, 23 * 60 + 59);
        
        const newFinishHour = Math.floor(totalFinishMinutes / 60);
        const newFinishMin = totalFinishMinutes % 60;
        newFinishTime = `${String(newFinishHour).padStart(2, '0')}:${String(newFinishMin).padStart(2, '0')}`;
      }
      
      // Update the drag state with new times for visual feedback
      setDragState(prev => ({
        ...prev,
        currentStartTime: newStartTime,
        currentFinishTime: newFinishTime
      }));
    });
  }, [dragState, isDragging]);

  const endDrag = useCallback(async () => {
    if (!dragState || !isDragging) return;
    
    const { task, dragType, currentStartTime, currentFinishTime } = dragState;
    
    // Validate task and required data
    if (!task || !task.id) {
      setDragState(null);
      setIsDragging(false);
      return;
    }
    
    try {
      // Update task with new times
      const updates = {};
      if (dragType === 'top' && currentStartTime) {
        // Validate time format
        if (/^\d{2}:\d{2}$/.test(currentStartTime)) {
          updates.start_time = currentStartTime;
        }
      }
      if (dragType === 'bottom' && currentFinishTime) {
        // Validate time format
        if (/^\d{2}:\d{2}$/.test(currentFinishTime)) {
          updates.finish_time = currentFinishTime;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await updateTask(task.id, updates);
      }
    } catch (error) {
      console.error('Failed to update task time:', error);
    }
    
    setDragState(null);
    setIsDragging(false);
  }, [dragState, isDragging, updateTask]);

  // Add global mouse event listeners for drag operations
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', endDrag);
      
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', endDrag);
      };
    }
  }, [isDragging, handleDrag, endDrag]);

  const hourSlots = generateHourSlots()
  
  // Filter slots based on early hours and late hours expansion state
  const visibleSlots = hourSlots.filter(slot => {
    if (slot.isEarlyHour && !isEarlyHoursExpanded) {
      return false
    }
    if (slot.isLateHour && !isLateHoursExpanded) {
      return false
    }
    return true
  })
  
  // Check if any early hour slots have tasks
  const earlyHoursHaveTasks = hourSlots
    .filter(slot => slot.isEarlyHour)
    .some(slot => slot.tasks.length > 0)
  
  // Count tasks in early hours
  const earlyHoursTaskCount = hourSlots
    .filter(slot => slot.isEarlyHour)
    .reduce((count, slot) => count + slot.tasks.length, 0)
    
  // Check if any late hour slots have tasks
  const lateHoursHaveTasks = hourSlots
    .filter(slot => slot.isLateHour)
    .some(slot => slot.tasks.length > 0)
  
  // Count tasks in late hours
  const lateHoursTaskCount = hourSlots
    .filter(slot => slot.isLateHour)
    .reduce((count, slot) => count + slot.tasks.length, 0)

  // Handle task hover for tooltip
  const handleTaskMouseEnter = (task, event) => {
    // Validate inputs
    if (!task || !event || !event.currentTarget) {
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const isMobile = windowWidth <= 768
    const tooltipWidth = isMobile ? Math.min(240, windowWidth - 40) : 280
    const estimatedTooltipHeight = 150 + (task.description ? 40 : 0) + (task.repeat_type && task.repeat_type !== 'none' ? 25 : 0)
    
    // Validate rect values
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    
    // Horizontal positioning - prefer right side, fall back to left
    let x = rect.right + 10
    if (x + tooltipWidth > windowWidth - 20) {
      x = rect.left - tooltipWidth - 10
      // If left positioning also goes off-screen, center it
      if (x < 20) {
        x = Math.max(20, (windowWidth - tooltipWidth) / 2)
      }
    }
    
    // Vertical positioning with enhanced viewport-aware strategy
    let y = rect.top
    const isInBottomHalf = rect.top > windowHeight / 2
    const tooltipWouldOverflow = rect.top + estimatedTooltipHeight > windowHeight - 20
    
    if (isInBottomHalf && tooltipWouldOverflow) {
      // For bottom-half elements, try bottom alignment first
      const bottomAlignedY = rect.bottom - estimatedTooltipHeight
      if (bottomAlignedY >= 20) {
        y = bottomAlignedY
      } else {
        // If bottom alignment fails, limit upward movement to maintain visual connection
        const maxUpwardMovement = Math.min(150, estimatedTooltipHeight * 0.7)
        y = Math.max(rect.top - maxUpwardMovement, 20)
      }
    } else if (tooltipWouldOverflow) {
      // For top-half elements that would overflow, move up with controlled overhang
      const allowedOverhang = 50
      y = Math.max(windowHeight - estimatedTooltipHeight - 20, rect.top - allowedOverhang)
    }
    // else: use default top alignment (y = rect.top)
    
    setTooltipPosition({ x, y })
    setHoveredTask(task)
  }

  const handleTaskMouseLeave = () => {
    setHoveredTask(null)
  }

  const handleICSImport = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.endsWith('.ics')) {
      alert('Please select a valid .ics file');
      return;
    }

    try {
      const importedTasks = await handleICSFileUpload(file);
      
      // Add each imported task
      for (const task of importedTasks) {
        await addTask(task);
      }
      
      alert(`Successfully imported ${importedTasks.length} events from ${file.name}`);
      event.target.value = ''; // Reset file input
    } catch (error) {
      console.error('Failed to import ICS file:', error);
      alert('Failed to import ICS file. Please check the console for details.');
    }
  };

  return (
    <div className="today-hour-schedule-page">
      <div className="hour-schedule-container">
        <div className="hour-schedule-header">
          <div className="date-info">
            <h1>Today's Hour Schedule</h1>
            <p className="current-date">{format(today, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="header-actions">
            <input 
              type="file" 
              accept=".ics" 
              onChange={handleICSImport} 
              style={{ display: 'none' }} 
              id="ics-file-input-hour" 
            />
            <label htmlFor="ics-file-input-hour" className="import-ics-button">
              Import ICS
            </label>
            <button 
              onClick={() => setShowTaskModal(true)}
              className="add-task-button"
            >
              <Plus size={20} />
              Add Task
            </button>
          </div>
        </div>

        <div className="hour-schedule-grid">
          {/* Early Hours Collapse/Expand Button */}
          {!isEarlyHoursExpanded && (
            <div className="early-hours-collapsed">
              <div className="time-label collapsed">
                <span className="time-display collapsed-time">12:00 AM - 5:59 AM</span>
              </div>
              <div className="tasks-column collapsed">
                <button 
                  className="expand-early-hours-button"
                  onClick={() => setIsEarlyHoursExpanded(true)}
                >
                  <ChevronDown size={16} />
                  <span>
                    Show early hours 
                    {earlyHoursTaskCount > 0 && (
                      <span className="task-count">({earlyHoursTaskCount} task{earlyHoursTaskCount !== 1 ? 's' : ''})</span>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}
          
          {/* Collapse Early Hours Button (when expanded) */}
          {isEarlyHoursExpanded && (
            <div className="early-hours-header">
              <div className="time-label">
                <span className="time-display">Early Hours</span>
              </div>
              <div className="tasks-column">
                <button 
                  className="collapse-early-hours-button"
                  onClick={() => setIsEarlyHoursExpanded(false)}
                >
                  <ChevronUp size={16} />
                  <span>Hide early hours (12 AM - 5 AM)</span>
                </button>
              </div>
            </div>
          )}
          
          {/* Hour Slots */}
          {visibleSlots.map(slot => (
            <div key={slot.hour} className="hour-slot" data-hour={slot.hour}>
              <div className="time-label">
                <span className="time-display">{slot.displayTime}</span>
              </div>
              <div className="tasks-column" style={{ position: 'relative', minHeight: '80px' }}>
                {slot.tasks.length === 0 ? (
                  <div className="empty-slot">
                    <span>No tasks scheduled</span>
                  </div>
                ) : (
                  <>
                    {slot.tasks.map(task => {
                      try {
                        // Validate task object
                        if (!task || typeof task !== 'object' || !task.id) {
                          return null;
                        }
                        
                        const priorityStyles = getPriorityStyles(task.priority || 3)
                        const positioning = getTaskPositioning(task, slot.hour)
                        
                        // Calculate task duration in minutes to determine if it's a short task
                        const getTaskDurationInMinutes = () => {
                          // Validate task time fields
                          if (!task.start_time || !task.finish_time || 
                              typeof task.start_time !== 'string' || typeof task.finish_time !== 'string') {
                            return 60; // Default 1 hour
                          }
                          
                          // Validate time format
                          if (!/^\d{2}:\d{2}$/.test(task.start_time) || !/^\d{2}:\d{2}$/.test(task.finish_time)) {
                            return 60; // Default 1 hour
                          }
                          
                          const [startHour, startMin] = task.start_time.split(':').map(Number)
                          const [endHour, endMin] = task.finish_time.split(':').map(Number)
                          
                          // Validate parsed values
                          if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin) ||
                              startHour < 0 || startHour > 23 || startMin < 0 || startMin > 59 ||
                              endHour < 0 || endHour > 23 || endMin < 0 || endMin > 59) {
                            return 60; // Default 1 hour
                          }
                          
                          const startTotal = startHour * 60 + startMin
                          const endTotal = endHour * 60 + endMin
                          return Math.max(1, endTotal - startTotal)
                        }
                        
                        const taskDurationMinutes = getTaskDurationInMinutes()
                        const isShortDuration = taskDurationMinutes <= 30
                        const isVeryShortDuration = taskDurationMinutes <= 5
                        
                        // Use current times during drag operation for visual feedback
                        const displayStartTime = dragState && dragState.task.id === task.id ? 
                          (dragState.currentStartTime || task.start_time) : task.start_time
                        const displayFinishTime = dragState && dragState.task.id === task.id ? 
                          (dragState.currentFinishTime || task.finish_time) : task.finish_time
                        
                        return (
                          <div 
                            key={`${task.id}-${slot.hour}`}
                            className={`hour-task-card continuous-task ${task.completed ? 'completed' : 'pending'}${isShortDuration ? ' short-duration' : ''}${isVeryShortDuration ? ' very-short' : ''}`}
                            onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                            onMouseLeave={handleTaskMouseLeave}
                            style={{
                              position: 'absolute',
                              top: `${positioning.top}%`,
                              left: '0.5rem',
                              right: '0.5rem',
                              height: `${positioning.height}%`,
                              borderLeft: `4px solid ${priorityStyles.color}`,
                              backgroundColor: task.completed ? 
                                'rgba(34, 197, 94, 0.1)' : 
                                priorityStyles.backgroundColor,
                              borderTopLeftRadius: positioning.isFirstHour ? '8px' : '0px',
                              borderTopRightRadius: positioning.isFirstHour ? '8px' : '0px',
                              borderBottomLeftRadius: positioning.isLastHour ? '8px' : '0px',
                              borderBottomRightRadius: positioning.isLastHour ? '8px' : '0px',
                              zIndex: isDragging && dragState && dragState.task.id === task.id ? 1000 : 2,
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              cursor: task.completed ? 'default' : 'default',
                              opacity: isDragging && dragState && dragState.task.id === task.id ? 0.8 : 1,
                            }}
                          >
                            {positioning.isFirstHour && (
                              <>
                                {/* Top drag handle for adjusting start time */}
                                {positioning.isFirstHour && !task.completed && (
                                  <div 
                                    className="task-drag-handle task-drag-top"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      startDrag(task, slot.hour, 'top', e);
                                    }}
                                  />
                                )}
                                <div className="task-header">
                                  <div className="task-title-section">
                                    <input
                                      type="checkbox"
                                      checked={task.completed}
                                      onChange={() => toggleTask(task.id)}
                                      className="task-checkbox"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <h3 className={`task-title ${task.completed ? 'completed-text' : ''}`}>
                                      {getRepeatIcon(task.repeat_type)} {task.title}
                                    </h3>
                                    <div className="task-badges">
                                      {task.repeat_type && task.repeat_type !== 'none' && (
                                        <span className="repeat-badge" title={formatRepeatType(task.repeat_type)}>
                                          🔄
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="task-actions">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditTask(task)
                                      }}
                                      className="edit-task-button"
                                      title="Edit task"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteTask(task.id)
                                      }}
                                      className="delete-button"
                                      title="Delete task"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                                {task.description && positioning.height > 10 && !isShortDuration && (
                                  <p className={`task-description ${task.completed ? 'completed-text' : ''}`}>
                                    {task.description}
                                  </p>
                                )}
                                {/* Time display removed as per user request */}
                              </>
                            )}
                            {/* Bottom drag handle for adjusting finish time */}
                            {positioning.isLastHour && !task.completed && (
                              <div 
                                className="task-drag-handle task-drag-bottom"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  startDrag(task, slot.hour, 'bottom', e);
                                }}
                              />
                            )}
                          </div>
                        )
                      } catch (error) {
                        console.error('Error rendering task:', error, task)
                        return null; // Skip rendering this task if there's an error
                      }
                    })}
                    {/* Show task name at 6 AM for tasks that start in early hours and continue past 6 AM */}
                    {slot.hour === 6 && !isEarlyHoursExpanded && slot.tasks.filter(task => {
                      try {
                        if (!task.start_time || !task.finish_time) return false;
                        const [startHour] = task.start_time.split(':').map(Number);
                        const [endHour] = task.finish_time.split(':').map(Number);
                        // Show task name at 6 AM if task starts before 6 AM (hour < 6) and ends at or after 6 AM
                        return startHour < 6 && endHour >= 6;
                      } catch (error) {
                        console.error('Error filtering early hour continuation tasks:', error);
                        return false;
                      }
                    }).map(task => {
                      try {
                        // Validate task object
                        if (!task || typeof task !== 'object' || !task.id) {
                          return null;
                        }
                        
                        return (
                          <div key={`continuation-${task.id}`} className="hour-task-card early-hour-continuation">
                            <div className="task-header">
                              <div className="task-title-section">
                                {/* Add checkbox for task completion in continuation display */}
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => toggleTask(task.id)}
                                  className="task-checkbox"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <h3 className={`task-title ${task.completed ? 'completed-text' : ''}`}>
                                  {getRepeatIcon(task.repeat_type)} {task.title}
                                </h3>
                              </div>
                            </div>
                          </div>
                        );
                      } catch (error) {
                        console.error('Error rendering early hour continuation task:', error, task);
                        return null; // Skip rendering this task if there's an error
                      }
                    })}
                  </>
                )}
              </div>
            </div>
          ))}
          
          {/* Late Hours Collapse/Expand Button */}
          {!isLateHoursExpanded && (
            <div className="late-hours-collapsed">
              <div className="time-label collapsed">
                <span className="time-display collapsed-time">10:00 PM - 11:59 PM</span>
              </div>
              <div className="tasks-column collapsed">
                <button 
                  className="expand-late-hours-button"
                  onClick={() => setIsLateHoursExpanded(true)}
                >
                  <ChevronDown size={16} />
                  <span>
                    Show late hours 
                    {lateHoursTaskCount > 0 && (
                      <span className="task-count">({lateHoursTaskCount} task{lateHoursTaskCount !== 1 ? 's' : ''})</span>
                    )}
                  </span>
                </button>
              </div>
            </div>
          )}
          
          {/* Collapse Late Hours Button (when expanded) */}
          {isLateHoursExpanded && (
            <div className="late-hours-header">
              <div className="time-label">
                <span className="time-display">Late Hours</span>
              </div>
              <div className="tasks-column">
                <button 
                  className="collapse-late-hours-button"
                  onClick={() => setIsLateHoursExpanded(false)}
                >
                  <ChevronUp size={16} />
                  <span>Hide late hours (10 PM - 11 PM)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Task Hover Tooltip */}
        {hoveredTask && (
          <div 
            className={`task-tooltip ${hoveredTask ? 'visible' : ''}`}
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`
            }}
          >
            <div className="tooltip-title">
              {getRepeatIcon(hoveredTask.repeat_type)} {hoveredTask.title}
            </div>
            
            {hoveredTask.description && (
              <div className="tooltip-description">
                {hoveredTask.description}
              </div>
            )}
            
            <div className="tooltip-details">
              <div className="tooltip-detail-row">
                <span className="tooltip-detail-label">Priority:</span>
                <span 
                  className="tooltip-priority"
                  style={{
                    backgroundColor: getPriorityStyles(hoveredTask.priority || 3).backgroundColor,
                    color: getPriorityStyles(hoveredTask.priority || 3).color,
                    border: `1px solid ${getPriorityStyles(hoveredTask.priority || 3).color}`
                  }}
                >
                  P{hoveredTask.priority || 3}
                </span>
              </div>
              
              <div className="tooltip-detail-row">
                <span className="tooltip-detail-label">Time:</span>
                <span className="tooltip-detail-value">
                  {hoveredTask.start_time && hoveredTask.finish_time
                    ? `${formatTime(hoveredTask.start_time)} - ${formatTime(hoveredTask.finish_time)}`
                    : hoveredTask.start_time
                    ? `Start: ${formatTime(hoveredTask.start_time)}`
                    : hoveredTask.finish_time
                    ? `End: ${formatTime(hoveredTask.finish_time)}`
                    : 'No time set'
                  }
                </span>
              </div>
              
              {hoveredTask.repeat_type && hoveredTask.repeat_type !== 'none' && (
                <div className="tooltip-detail-row">
                  <span className="tooltip-detail-label">Repeat:</span>
                  <span className="tooltip-repeat-badge">
                    🔄 {formatRepeatType(hoveredTask.repeat_type)}
                  </span>
                </div>
              )}
              
              <div className="tooltip-detail-row">
                <span className="tooltip-detail-label">Status:</span>
                <span className="tooltip-detail-value">
                  {hoveredTask.completed ? '✅ Completed' : '⏳ Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        {showTaskModal && (
          <TaskModal
            onClose={handleCloseTaskModal}
            onSave={handleSaveTask}
            selectedDate={today}
            task={editingTask}
            isEditing={!!editingTask}
          />
        )}
      </div>
    </div>
  )
}

export default TodayHourSchedulePage