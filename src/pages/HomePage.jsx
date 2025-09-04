import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { formatDateForAPI } from '../utils/dateUtils'
import './HomePage.css'

function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showTaskModal, setShowTaskModal] = useState(false)
  const { tasks, loading, addTask, toggleTask, deleteTask } = useTasks()

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
        date: formatDateForAPI(selectedDate)
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
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
                className={`calendar-day ${isSelected ? 'selected' : ''} ${isTodayDate ? 'today' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-tasks">
                  {dayTasks.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className={`task-indicator ${task.completed ? 'completed' : ''}`}
                      title={task.title}
                    >
                      {task.title.substring(0, 20)}
                      {task.title.length > 20 ? '...' : ''}
                    </div>
                  ))}
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
              getTasksForDate(selectedDate).map(task => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                  />
                  <div className="task-content">
                    <h4>{task.title}</h4>
                    {task.description && <p>{task.description}</p>}
                    {task.time && <span className="task-time">{task.time}</span>}
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="delete-button"
                  >
                    ×
                  </button>
                </div>
              ))
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