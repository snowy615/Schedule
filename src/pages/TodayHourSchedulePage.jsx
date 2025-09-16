import { useState } from 'react'
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
  const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTasks()
  const today = new Date()

  const todayTasks = tasks
    .filter(task => isToday(parseDateSafely(task.date)))
    .sort((a, b) => {
      // Sort by start_time first, then by finish_time, then by creation time
      if (!a.start_time && !b.start_time) return 0
      if (!a.start_time) return 1
      if (!b.start_time) return -1
      
      const startTimeComparison = a.start_time.localeCompare(b.start_time)
      if (startTimeComparison !== 0) return startTimeComparison
      
      // If start times are equal, sort by finish time
      if (!a.finish_time && !b.finish_time) return 0
      if (!a.finish_time) return 1
      if (!b.finish_time) return -1
      return a.finish_time.localeCompare(b.finish_time)
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
  }

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const getTasksForHour = (hour) => {
    return getTasksSpanningHour(hour)
  }

  // Get tasks that span through a specific hour (including partial overlaps)
  const getTasksSpanningHour = (hour) => {
    return todayTasks.filter(task => {
      if (!task.start_time || !task.finish_time) {
        // For tasks without end time, only show in start hour
        if (!task.start_time) return false
        const taskHour = parseInt(task.start_time.split(':')[0])
        return taskHour === hour
      }
      
      const [startHour, startMin] = task.start_time.split(':').map(Number)
      const [endHour, endMin] = task.finish_time.split(':').map(Number)
      
      const taskStartTime = startHour + startMin / 60
      const taskEndTime = endHour + endMin / 60
      
      // Task spans this hour if it starts before or during this hour and ends after it starts
      return taskStartTime <= hour + 1 && taskEndTime > hour
    })
  }

  // Calculate task positioning within hour slots
  const getTaskPositioning = (task, hour) => {
    if (!task.start_time || !task.finish_time) {
      // For tasks without proper time, show them at the top of the hour
      return {
        top: 0,
        height: 60, // Default 1 hour height
        startOffset: 0,
        endOffset: 0,
        isFirstHour: true,
        isLastHour: true,
        isSingleHour: true
      }
    }
    
    const [startHour, startMin] = task.start_time.split(':').map(Number)
    const [endHour, endMin] = task.finish_time.split(':').map(Number)
    
    const taskStartTime = startHour + startMin / 60
    const taskEndTime = endHour + endMin / 60
    
    // Calculate position within this hour slot (80px per hour to match min-height)
    const hourStart = hour
    const hourEnd = hour + 1
    
    // Find the overlap with this hour
    const overlapStart = Math.max(taskStartTime, hourStart)
    const overlapEnd = Math.min(taskEndTime, hourEnd)
    
    // Convert to pixels (80px per hour)
    const startOffset = (overlapStart - hourStart) * 80
    const height = (overlapEnd - overlapStart) * 80
    
    // Determine if this is the first, last, or middle hour of the task
    const isFirstHour = hour === startHour
    const isLastHour = (hour === endHour && endMin > 0) || (hour === endHour - 1 && endMin === 0)
    const isSingleHour = Math.floor(taskStartTime) === Math.floor(taskEndTime) && 
                         (Math.floor(taskStartTime) === hour || Math.floor(taskEndTime) === hour)
    
    return {
      top: startOffset,
      height: Math.max(height, 20), // Minimum 20px height
      startOffset: startOffset,
      endOffset: 80 - (startOffset + height),
      isFirstHour,
      isLastHour,
      isSingleHour,
      isMiddleHour: !isFirstHour && !isLastHour
    }
  }

  const getTaskDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 1 // Default duration if no end time
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startTotal = startHour * 60 + startMin
    const endTotal = endHour * 60 + endMin
    
    return Math.max(1, Math.ceil((endTotal - startTotal) / 60)) // At least 1 hour
  }

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
    const rect = event.currentTarget.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    const isMobile = windowWidth <= 768
    const tooltipWidth = isMobile ? Math.min(240, windowWidth - 40) : 280
    const estimatedTooltipHeight = 150 + (task.description ? 40 : 0) + (task.repeat_type && task.repeat_type !== 'none' ? 25 : 0)
    
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
            <div key={slot.hour} className="hour-slot">
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
                      const priorityStyles = getPriorityStyles(task.priority || 3)
                      const positioning = getTaskPositioning(task, slot.hour)
                      
                      // Calculate task duration in minutes to determine if it's a short task
                      const getTaskDurationInMinutes = () => {
                        if (!task.start_time || !task.finish_time) return 60 // Default 1 hour
                        const [startHour, startMin] = task.start_time.split(':').map(Number)
                        const [endHour, endMin] = task.finish_time.split(':').map(Number)
                        const startTotal = startHour * 60 + startMin
                        const endTotal = endHour * 60 + endMin
                        return endTotal - startTotal
                      }
                      
                      const taskDurationMinutes = getTaskDurationInMinutes()
                      const isShortDuration = taskDurationMinutes <= 30
                      
                      return (
                        <div 
                          key={`${task.id}-${slot.hour}`}
                          className={`hour-task-card continuous-task ${task.completed ? 'completed' : 'pending'}${isShortDuration ? ' short-duration' : ''}`}
                          onMouseEnter={(e) => handleTaskMouseEnter(task, e)}
                          onMouseLeave={handleTaskMouseLeave}
                          style={{
                            position: 'absolute',
                            top: `${positioning.top}px`,
                            left: '0.5rem',
                            right: '0.5rem',
                            height: `${positioning.height}px`,
                            borderLeft: `4px solid ${priorityStyles.color}`,
                            backgroundColor: task.completed ? 
                              'rgba(34, 197, 94, 0.1)' : 
                              priorityStyles.backgroundColor,
                            borderTopLeftRadius: positioning.isFirstHour ? '8px' : '0px',
                            borderTopRightRadius: positioning.isFirstHour ? '8px' : '0px',
                            borderBottomLeftRadius: positioning.isLastHour ? '8px' : '0px',
                            borderBottomRightRadius: positioning.isLastHour ? '8px' : '0px',
                            zIndex: 2,
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden'
                          }}
                        >
                          {positioning.isFirstHour && (
                            <>
                              <div className="task-header">
                                <div className="task-title-section">
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
                              {task.description && positioning.height > 60 && !isShortDuration && (
                                <p className={`task-description ${task.completed ? 'completed-text' : ''}`}>
                                  {task.description}
                                </p>
                              )}
                              {/* Time display removed as per user request */}
                            </>
                          )}
                        </div>
                      )
                    })}
                    {/* Show task name at 6 AM for tasks that start in early hours and continue past 6 AM */}
                    {slot.hour === 6 && !isEarlyHoursExpanded && slot.tasks.filter(task => {
                      if (!task.start_time || !task.finish_time) return false;
                      const [startHour] = task.start_time.split(':').map(Number);
                      const [endHour] = task.finish_time.split(':').map(Number);
                      // Show task name at 6 AM if task starts before 6 AM (hour < 6) and ends at or after 6 AM
                      return startHour < 6 && endHour >= 6;
                    }).map(task => (
                      <div key={`continuation-${task.id}`} className="hour-task-card early-hour-continuation">
                        <div className="task-header">
                          <div className="task-title-section">
                            <h3 className={`task-title ${task.completed ? 'completed-text' : ''}`}>
                              {getRepeatIcon(task.repeat_type)} {task.title}
                            </h3>
                          </div>
                        </div>
                      </div>
                    ))}
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