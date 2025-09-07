import { useState } from 'react'
import { format, isToday } from 'date-fns'
import { Plus, Clock } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { getTodayDateString, getTomorrowDateString, parseDateSafely } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatRepeatType, getRepeatIcon } from '../utils/repeatUtils'
import './TodayHourSchedulePage.css'

function TodayHourSchedulePage() {
  const [showTaskModal, setShowTaskModal] = useState(false)
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
      slots.push({
        hour,
        timeString,
        displayTime,
        tasks: getTasksForHour(hour)
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
    return todayTasks.filter(task => {
      if (!task.start_time) return false
      
      const taskHour = parseInt(task.start_time.split(':')[0])
      return taskHour === hour
    })
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
        {hourSlots.map(slot => (
          <div key={slot.hour} className="hour-slot">
            <div className="time-label">
              <span className="time-display">{slot.displayTime}</span>
            </div>
            <div className="tasks-column">
              {slot.tasks.length === 0 ? (
                <div className="empty-slot">
                  <span>No tasks scheduled</span>
                </div>
              ) : (
                slot.tasks.map(task => {
                  const priorityStyles = getPriorityStyles(task.priority || 3)
                  const duration = getTaskDuration(task.start_time, task.finish_time)
                  
                  return (
                    <div 
                      key={task.id} 
                      className={`hour-task-card ${task.completed ? 'completed' : 'pending'}`}
                      style={{
                        borderLeft: `4px solid ${priorityStyles.color}`,
                        backgroundColor: task.completed ? 
                          'rgba(34, 197, 94, 0.1)' : 
                          priorityStyles.backgroundColor,
                        minHeight: `${duration * 60}px` // Scale based on duration
                      }}
                    >
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
                      {task.description && (
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
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
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