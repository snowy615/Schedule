import { useState } from 'react'
import { format, isToday, isBefore } from 'date-fns'
import { Plus, Clock, Edit2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import TaskModal from '../components/TaskModal'
import { getTodayDateString, getTomorrowDateString, parseDateSafely } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatRepeatType, getRepeatIcon } from '../utils/repeatUtils'
import { handleICSFileUpload } from '../utils/icsUtils'
import './TasksTodayPage.css'

function TasksTodayPage() {
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTasks()
  const today = new Date()

  // Filter overdue tasks (incomplete tasks from previous days)
  const overdueTasks = tasks
    .filter(task => !task.completed && isBefore(parseDateSafely(task.date), new Date(getTodayDateString())))
    .sort((a, b) => {
      // Sort by date (oldest first), then by start_time
      const dateComparison = parseDateSafely(a.date) - parseDateSafely(b.date)
      if (dateComparison !== 0) return dateComparison
      
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

  // Filter today's tasks - include ALL tasks for today (both pending and completed)
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

  // Separate pending and completed tasks
  const completedTasks = todayTasks.filter(task => task.completed);
  const pendingTasks = todayTasks.filter(task => !task.completed);

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
          date: getTomorrowDateString()
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

  const renderTaskItem = (task, isOverdue = false) => {
    const priorityStyles = getPriorityStyles(task.priority || 3)
    return (
      <div key={task.id} className={`timeline-item ${task.completed ? 'completed' : 'pending'} ${isOverdue ? 'overdue' : ''}`}
           style={{
             borderLeft: `4px solid ${priorityStyles.color}`,
             backgroundColor: priorityStyles.backgroundColor
           }}>
        <div className="timeline-marker" style={{ backgroundColor: priorityStyles.color }}></div>
        <div className="timeline-content">
          <div className="task-card">
            <div className="task-header">
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
                className="task-checkbox"
              />
              <div className="task-title-section">
                <h3 className="task-title">
                  {isOverdue && <span className="overdue-badge">OVERDUE</span>}
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
              <div className="task-actions">
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEditTask(task)
                  }}
                  className="edit-button"
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
                >
                  ×
                </button>
              </div>
            </div>
            {task.description && (
              <p className="task-description">{task.description}</p>
            )}
            {task.attachments && (
              <div className="task-attachments">
                <h4>Attachments & Notes:</h4>
                <pre className="attachments-content">{task.attachments}</pre>
              </div>
            )}
            <div className="task-time">
              <Clock size={16} />
              <span>{getTimeSlot(task.start_time, task.finish_time)}</span>
              {isOverdue && (
                <span className="overdue-date">Due: {format(parseDateSafely(task.date), 'MMM d, yyyy')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
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
    <div className="tasks-today-page">
      <div className="page-header">
        <h1>Today's Tasks</h1>
        <div className="header-actions">
          <input 
            type="file" 
            accept=".ics" 
            onChange={handleICSImport} 
            style={{ display: 'none' }} 
            id="ics-file-input-today" 
          />
          <label htmlFor="ics-file-input-today" className="import-ics-button">
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
        {todayTasks.length === 0 && overdueTasks.length === 0 ? (
          <div className="no-tasks">
            <Clock size={48} />
            <h3>No tasks for today</h3>
            <p>Add a task to get started!</p>
          </div>
        ) : (
          <div className="timeline">
            {overdueTasks.length > 0 && (
              <>
                <div className="timeline-separator overdue-separator">
                  <span>Overdue Tasks</span>
                </div>
                {overdueTasks.map(task => renderTaskItem(task, true))}
              </>
            )}
            
            {pendingTasks.map(task => renderTaskItem(task))}
            
            {completedTasks.length > 0 && (
              <>
                <div className="timeline-separator">
                  <span>Completed Tasks</span>
                </div>
                {completedTasks.map(task => renderTaskItem(task))}
              </>
            )}
          </div>
        )}
      </div>

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
  )
}

export default TasksTodayPage