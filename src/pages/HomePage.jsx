import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { formatDateForAPI, formatDateForAPIWithDelay } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import './HomePage.css'

function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)
  const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTasks()

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const getTasksForDate = (date) => {
    return tasks.filter(task => isSameDay(new Date(task.date), date))
  }

  const handleAddTask = async (taskData) => {
    try {
      await addTask({
        ...taskData,
        date: formatDateForAPIWithDelay(selectedDate) // Add 24 hours to selected date
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id.toString())
    
    // Create custom drag image
    const dragImage = document.createElement('div')
    dragImage.textContent = `📝 ${task.title}`
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      background: #2a2a2a;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      border-left: 3px solid ${getPriorityStyles(task.priority || 3).color};
      font-size: 14px;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    `
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    // Clean up drag image after drag starts
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 0)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverDate(null)
  }

  const handleDragOver = (e, date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Only set drag over if we have a dragged task
    if (draggedTask) {
      setDragOverDate(date)
    }
  }

  const handleDragLeave = (e) => {
    // Only clear dragOverDate if we're leaving the drop zone completely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverDate(null)
    }
  }

  const handleDrop = async (e, targetDate) => {
    e.preventDefault()
    setDragOverDate(null)
    
    if (!draggedTask) return
    
    const newDateString = formatDateForAPIWithDelay(targetDate)
    const oldDateString = draggedTask.date
    
    // Don't update if dropping on the same date
    if (newDateString === oldDateString) {
      setDraggedTask(null)
      return
    }
    
    try {
      // Optimistically update the UI
      const originalDate = draggedTask.date
      
      // Show loading state
      console.log(`Moving "${draggedTask.title}" from ${format(new Date(originalDate), 'MMM d')} to ${format(targetDate, 'MMM d')}...`)
      
      await updateTask(draggedTask.id, { date: newDateString })
      
      // Show success feedback
      console.log(`✓ Task "${draggedTask.title}" successfully moved to ${format(targetDate, 'MMM d, yyyy')}`)
      
      // Optional: Add visual success feedback here
      
    } catch (error) {
      console.error('Failed to move task:', error)
      
      // Show error feedback
      alert(`Failed to move task "${draggedTask.title}". Please try again.`)
      
      // Revert optimistic update would happen automatically via useTasks
    }
    
    setDraggedTask(null)
  }

  return (
    <div className="home-page">
      <div className="calendar-header">
        <div className="month-navigation">
          <button onClick={() => navigateMonth(-1)} className="nav-button">
            <ChevronLeft size={20} />
          </button>
          <h2>{format(currentDate, 'MMMM yyyy')}</h2>
          <button onClick={() => navigateMonth(1)} className="nav-button">
            <ChevronRight size={20} />
          </button>
        </div>
        <button 
          onClick={() => setShowTaskModal(true)}
          className="add-task-button"
        >
          <Plus size={20} />
          Add Task
        </button>
      </div>

      <div className="calendar-grid">
        <div className="weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="days-grid">
          {daysInMonth.map(day => {
            const dayTasks = getTasksForDate(day)
            const isSelected = isSameDay(day, selectedDate)
            const isTodayDate = isToday(day)
            
            return (
              <div
                key={day.toISOString()}
                className={`calendar-day ${
                  isSelected ? 'selected' : ''
                } ${
                  isTodayDate ? 'today' : ''
                } ${
                  dragOverDate && isSameDay(dragOverDate, day) ? 'drag-over' : ''
                }`}
                onClick={() => setSelectedDate(day)}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-tasks">
                  {dayTasks.slice(0, 3).map(task => {
                    const priorityStyles = getPriorityStyles(task.priority || 3)
                    const isDragging = draggedTask && draggedTask.id === task.id
                    return (
                      <div
                        key={task.id}
                        className={`task-indicator ${
                          task.completed ? 'completed' : ''
                        } ${
                          isDragging ? 'dragging' : ''
                        }`}
                        style={{
                          borderLeft: `3px solid ${priorityStyles.color}`,
                          backgroundColor: priorityStyles.backgroundColor,
                          opacity: isDragging ? 0.5 : 1
                        }}
                        title={`${task.title} (${task.priority ? `P${task.priority}` : 'P3'})`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      >
                        {task.title.substring(0, 20)}
                        {task.title.length > 20 ? '...' : ''}
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <div className="more-tasks">+{dayTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="selected-date-tasks">
        <h3>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading tasks...</p>
          </div>
        ) : (
          <div className="tasks-list">
            {getTasksForDate(selectedDate).length === 0 ? (
              <p className="no-tasks">No tasks for this day</p>
            ) : (
              getTasksForDate(selectedDate).map(task => {
                const priorityStyles = getPriorityStyles(task.priority || 3)
                const isDragging = draggedTask && draggedTask.id === task.id
                return (
                  <div key={task.id} className={`task-item ${
                    task.completed ? 'completed' : ''
                  } ${
                    isDragging ? 'dragging' : ''
                  }`}
                       style={{
                         borderLeft: `4px solid ${priorityStyles.color}`,
                         backgroundColor: priorityStyles.backgroundColor,
                         opacity: isDragging ? 0.5 : 1
                       }}
                       draggable
                       onDragStart={(e) => handleDragStart(e, task)}
                       onDragEnd={handleDragEnd}
                  >
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                    />
                    <div className="task-content">
                      <div className="task-header-info">
                        <h4>{task.title}</h4>
                        <span className="priority-badge" style={{ color: priorityStyles.color }}>
                          P{task.priority || 3}
                        </span>
                      </div>
                      {task.description && <p>{task.description}</p>}
                      {(task.start_time || task.finish_time) && (
                        <span className="task-time">
                          {task.start_time && task.finish_time 
                            ? `${task.start_time} - ${task.finish_time}`
                            : task.start_time 
                              ? `Start: ${task.start_time}`
                              : `End: ${task.finish_time}`
                          }
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="delete-button"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSave={handleAddTask}
          selectedDate={selectedDate}
        />
      )}
    </div>
  )
}

export default HomePage