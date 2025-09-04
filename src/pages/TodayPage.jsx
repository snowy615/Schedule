import { useState } from 'react'
import { format, isToday } from 'date-fns'
import { Plus, Clock } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { getTodayDateString } from '../utils/dateUtils'
import './TodayPage.css'

function TodayPage() {
  const [showTaskModal, setShowTaskModal] = useState(false)
  const { tasks, loading, addTask, toggleTask, deleteTask } = useTasks()
  const today = new Date()

  const todayTasks = tasks
    .filter(task => isToday(new Date(task.date)))
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
        date: getTodayDateString()
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
  }

  const completedTasks = todayTasks.filter(task => task.completed)
  const pendingTasks = todayTasks.filter(task => !task.completed)

  const getTimeSlot = (start_time, finish_time) => {
    if (!start_time && !finish_time) return 'No time set'
    
    const formatTime = (time) => {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minutes} ${ampm}`
    }
    
    if (start_time && finish_time) {
      return `${formatTime(start_time)} - ${formatTime(finish_time)}`
    } else if (start_time) {
      return `Start: ${formatTime(start_time)}`
    } else {
      return `End: ${formatTime(finish_time)}`
    }
  }

  return (
    <div className="today-page">
      <div className="today-header">
        <div className="date-info">
          <h1>Today's Schedule</h1>
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

      <div className="progress-section">
        <div className="progress-stats">
          <div className="stat">
            <span className="stat-number">{pendingTasks.length}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat">
            <span className="stat-number">{completedTasks.length}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat">
            <span className="stat-number">{todayTasks.length}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
        {todayTasks.length > 0 && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(completedTasks.length / todayTasks.length) * 100}%` }}
            ></div>
          </div>
        )}
      </div>

      <div className="tasks-timeline">
        {todayTasks.length === 0 ? (
          <div className="no-tasks">
            <Clock size={48} />
            <h3>No tasks for today</h3>
            <p>Add a task to get started!</p>
          </div>
        ) : (
          <div className="timeline">
            {pendingTasks.map(task => (
              <div key={task.id} className="timeline-item pending">
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <div className="task-card">
                    <div className="task-header">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.id)}
                        className="task-checkbox"
                      />
                      <h3 className="task-title">{task.title}</h3>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="delete-button"
                      >
                        ×
                      </button>
                    </div>
                    {task.description && (
                      <p className="task-description">{task.description}</p>
                    )}
                    <div className="task-time">
                      <Clock size={16} />
                      <span>{getTimeSlot(task.time)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {completedTasks.length > 0 && (
              <>
                <div className="timeline-separator">
                  <span>Completed Tasks</span>
                </div>
                {completedTasks.map(task => (
                  <div key={task.id} className="timeline-item completed">
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                      <div className="task-card">
                        <div className="task-header">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => toggleTask(task.id)}
                            className="task-checkbox"
                          />
                          <h3 className="task-title">{task.title}</h3>
                          <button 
                            onClick={() => deleteTask(task.id)}
                            className="delete-button"
                          >
                            ×
                          </button>
                        </div>
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                        <div className="task-time">
                          <Clock size={16} />
                          <span>{getTimeSlot(task.start_time, task.finish_time)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSave={handleAddTask}
          selectedDate={today}
        />
      )}
    </div>
  )
}

export default TodayPage