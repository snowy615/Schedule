import { useState } from 'react'
import { format, isToday } from 'date-fns'
import { Plus, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { getTodayDateString, getTomorrowDateString, parseDateSafely } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatRepeatType, getRepeatIcon } from '../utils/repeatUtils'
import './TodayHourSchedulePage.css'

function TodayHourSchedulePage() {
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [isEarlyHoursExpanded, setIsEarlyHoursExpanded] = useState(false)
  const [isLateHoursExpanded, setIsLateHoursExpanded] = useState(false)
  const { tasks, loading, addTask, toggleTask, deleteTask } = useTasks()
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
        date: getTomorrowDateString() // Add 24 hours to today's date
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
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
        isLastHour: true
      }
    }
    
    const [startHour, startMin] = task.start_time.split(':').map(Number)
    const [endHour, endMin] = task.finish_time.split(':').map(Number)
    
    const taskStartTime = startHour + startMin / 60
    const taskEndTime = endHour + endMin / 60
    
    // Calculate position within this hour slot (80px per hour)
    const hourStart = hour
    const hourEnd = hour + 1
    
    // Find the overlap with this hour
    const overlapStart = Math.max(taskStartTime, hourStart)
    const overlapEnd = Math.min(taskEndTime, hourEnd)
    
    // Convert to pixels (80px per hour to match min-height)
    const startOffset = (overlapStart - hourStart) * 80
    const height = (overlapEnd - overlapStart) * 80
    
    return {
      top: startOffset,
      height: Math.max(height, 20), // Minimum 20px height
      startOffset: startOffset,
      endOffset: 80 - (startOffset + height),
      isFirstHour: hour === startHour,
      isLastHour: hour === endHour || (endHour === hour + 1 && endMin === 0)
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

  return (
    <div className="today-hour-schedule-page">
      <div className="hour-schedule-header">
        <div className="date-info">
          <h1>Today's Hour Schedule</h1>
          <p className="current-date">{format(today, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button 
          onClick={() => setShowTaskModal(true)}
          className="add-task-button"
        >
          <Plus size={20} />
          Add Task
        </button>
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
                slot.tasks.map(task => {
                  const priorityStyles = getPriorityStyles(task.priority || 3)
                  const positioning = getTaskPositioning(task, slot.hour)
                  
                  return (
                    <div 
                      key={`${task.id}-${slot.hour}`}
                      className={`hour-task-card continuous-task ${task.completed ? 'completed' : 'pending'}`}
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
                        borderTopLeftRadius: positioning.isFirstHour ? '6px' : '2px',
                        borderTopRightRadius: positioning.isFirstHour ? '6px' : '2px',
                        borderBottomLeftRadius: positioning.isLastHour ? '6px' : '2px',
                        borderBottomRightRadius: positioning.isLastHour ? '6px' : '2px',
                        zIndex: 2
                      }}
                    >
                      {positioning.isFirstHour && (
                        <>
                          <div className="task-header">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => toggleTask(task.id)}
                              className="task-checkbox"
                            />
                            <div className="task-title-section">
                              <h3 className={`task-title ${task.completed ? 'completed-text' : ''}`}>
                                {getRepeatIcon(task.repeat_type)} {task.title}
                              </h3>
                              <div className="task-badges">
                                <span className="priority-badge" style={{ color: priorityStyles.color }}>
                                  P{task.priority || 3}
                                </span>
                                {task.repeat_type && task.repeat_type !== 'none' && (
                                  <span className="repeat-badge" title={formatRepeatType(task.repeat_type)}>
                                    🔄
                                  </span>
                                )}
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteTask(task.id)}
                              className="delete-button"
                            >
                              ×
                            </button>
                          </div>
                          {task.description && positioning.height > 100 && (
                            <p className={`task-description ${task.completed ? 'completed-text' : ''}`}>
                              {task.description}
                            </p>
                          )}
                          <div className="task-time-info">
                            <Clock size={14} />
                            <span>
                              {task.start_time && task.finish_time
                                ? `${formatTime(task.start_time)} - ${formatTime(task.finish_time)}`
                                : task.start_time
                                ? `Start: ${formatTime(task.start_time)}`
                                : task.finish_time
                                ? `End: ${formatTime(task.finish_time)}`
                                : 'No time set'
                              }
                            </span>
                          </div>
                        </>
                      )}
                      {!positioning.isFirstHour && (
                        <div className="task-continuation">
                          <span className="continuation-text">{task.title} (continued)</span>
                        </div>
                      )}
                    </div>
                  )
                })
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

      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSubmit={handleAddTask}
          initialDate={format(today, 'yyyy-MM-dd')}
        />
      )}
    </div>
  )
}

export default TodayHourSchedulePage