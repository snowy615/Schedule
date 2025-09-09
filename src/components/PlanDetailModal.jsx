import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, CheckCircle, Circle, Edit2, Plus, Trash2, Save, Calendar, Share2, Users } from 'lucide-react'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatDateForAPI, parseDateSafely } from '../utils/dateUtils'
import SharePlanModal from './SharePlanModal'
import { usePlans } from '../hooks/usePlans'
import './PlanDetailModal.css'

function PlanDetailModal({ plan, onClose, onCompleteTask, onAddTask, onUpdateTask, onDeleteTask }) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(plan.current_task_index || 0)
  const [tasks, setTasks] = useState(plan.tasks || [])
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 3, date: formatDateForAPI(new Date()) })
  const [showShareModal, setShowShareModal] = useState(false)
  const { setIndividualTaskStatus } = usePlans()

  // Check if the user has write permissions for this plan
  const hasWritePermission = !plan.is_shared || (plan.shared_permissions === 'write');
  // Check if the user has individual permissions for this plan
  const hasIndividualPermission = plan.is_shared && plan.shared_permissions === 'individual';

  const priorityOptions = [
    { value: 1, label: 'P1 - Urgent', color: '#dc2626' },
    { value: 2, label: 'P2 - High', color: '#ea580c' },
    { value: 3, label: 'P3 - Medium', color: '#2563eb' },
    { value: 4, label: 'P4 - Low', color: '#16a34a' },
    { value: 5, label: 'P5 - Very Low', color: '#6b7280' }
  ]

  useEffect(() => {
    if (plan.tasks) {
      setTasks(plan.tasks)
      setCurrentTaskIndex(plan.current_task_index || 0)
    }
  }, [plan])

  // Calculate currentTask based on currentTaskIndex and tasks array
  const currentTask = tasks.length > 0 && currentTaskIndex < tasks.length ? tasks[currentTaskIndex] : null
  const isCompleted = hasIndividualPermission ? 
    (tasks.length > 0 && tasks.every(task => task.completed)) : 
    (currentTaskIndex >= tasks.length)

  // Calculate progress for individual users
  const calculateProgress = () => {
    if (tasks.length === 0) return 0;
    
    if (hasIndividualPermission) {
      // For individual users, progress is based on completed tasks
      const completedCount = tasks.filter(task => task.completed).length;
      return Math.round((completedCount / tasks.length) * 100);
    } else {
      // For owner/write users, progress is based on current task index
      return Math.round((currentTaskIndex / tasks.length) * 100);
    }
  };

  const completedCount = hasIndividualPermission ? 
    tasks.filter(task => task.completed).length : 
    currentTaskIndex;

  const handleCompleteCurrentTask = () => {
    if (!isCompleted && currentTask) {
      if (hasIndividualPermission) {
        // For individual permission, use the individual task completion handler
        handleIndividualTaskComplete(currentTask, true);
      } else {
        // For owner/write permissions, use the standard completion
        onCompleteTask();
        // Optimistically update UI
        setTasks(prev => 
          prev.map((task, index) => 
            index === currentTaskIndex ? { ...task, completed: true } : task
          )
        );
        setCurrentTaskIndex(prev => prev + 1);
      }
    }
  }

  // Add individual task completion handler
  const handleIndividualTaskComplete = async (task, completed) => {
    if (!hasIndividualPermission) return;
    
    try {
      await setIndividualTaskStatus(plan.id, task.id, completed);
      // Optimistically update UI
      setTasks(prev => 
        prev.map(t => 
          t.id === task.id ? { ...t, completed } : t
        )
      )
      
      // For individual permission, we need to update the current task index if this was the current task
      if (completed && task.id === currentTask?.id) {
        // Find the next incomplete task
        const nextIndex = tasks.findIndex((t, index) => index > currentTaskIndex && !t.completed);
        if (nextIndex !== -1) {
          setCurrentTaskIndex(nextIndex);
        } else {
          // If all tasks are completed, set to tasks.length to indicate completion
          setCurrentTaskIndex(tasks.length);
        }
      }
    } catch (error) {
      console.error('Failed to update individual task status:', error)
      alert('Failed to update task status. Please try again.')
    }
  }

  const handleEditTask = (task) => {
    setEditingTaskId(task.id)
    setEditingTask({ ...task })
  }

  const handleSaveTask = async () => {
    if (!editingTask || !editingTask.title.trim()) return
    
    try {
      await onUpdateTask(plan.id, editingTaskId, {
        title: editingTask.title.trim(),
        description: editingTask.description ? editingTask.description.trim() : null,
        priority: editingTask.priority,
        date: editingTask.date
      })
      setEditingTaskId(null)
      setEditingTask(null)
    } catch (error) {
      console.error('Failed to update task:', error)
      alert('Failed to update task. Please try again.')
    }
  }

  const handleCancelEdit = () => {
    setEditingTaskId(null)
    setEditingTask(null)
  }

  const handleDeleteTask = async (taskId) => {
    if (tasks.length <= 1) {
      alert('Cannot delete the last task in a plan. A plan must have at least one task.')
      return
    }
    
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await onDeleteTask(plan.id, taskId)
      } catch (error) {
        console.error('Failed to delete task:', error)
        alert('Failed to delete task. Please try again.')
      }
    }
  }

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return
    
    try {
      await onAddTask(plan.id, {
        title: newTask.title.trim(),
        description: newTask.description ? newTask.description.trim() : null,
        priority: newTask.priority,
        date: newTask.date
      })
      setNewTask({ title: '', description: '', priority: 3, date: formatDateForAPI(new Date()) })
      setShowAddTask(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      alert('Failed to add task. Please try again.')
    }
  }

  const handleShareSuccess = () => {
    // Refresh the plan data or show a success message
    console.log('Plan shared successfully')
  }

  const getTaskStatus = (task, index) => {
    if (hasIndividualPermission) {
      // For individual users, status is based on task completion
      return task.completed ? 'completed' : 'pending';
    } else {
      // For owner/write users, status is based on current task index
      if (index < currentTaskIndex) return 'completed';
      if (index === currentTaskIndex && !isCompleted) return 'current';
      return 'pending';
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content plan-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📋 {plan.title}</h2>
            <div className="modal-actions">
              {!plan.is_shared && (
                <button 
                  onClick={() => setShowShareModal(true)} 
                  className="share-button"
                  title="Share plan"
                >
                  <Share2 size={18} />
                  <span className="share-button-text">Share</span>
                </button>
              )}
              <button onClick={onClose} className="close-button">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="modal-date">
            <span>Date: {format(parseDateSafely(plan.date), 'EEEE, MMMM d, yyyy')}</span>
            {plan.is_shared && (
              <span className="shared-badge">
                {plan.shared_permissions === 'write' ? 'Collaborator' : 
                 plan.shared_permissions === 'individual' ? 'Individual' : 'Viewer'}
              </span>
            )}
            {!plan.is_shared && (
              <span className="ownership-indicator">Owner</span>
            )}
          </div>

          <div className="plan-detail-content">
            {plan.description && (
              <div className="plan-description">
                <p>{plan.description}</p>
              </div>
            )}

            <div className="plan-progress">
              <div className="progress-header">
                <h3>Progress</h3>
                <div className="progress-stats">
                  <span className="completed-count">{completedCount}</span>
                  <span className="separator">/</span>
                  <span className="total-count">{tasks.length}</span>
                  <span className="progress-label">tasks completed</span>
                </div>
              </div>
              
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
            </div>

            {!isCompleted && currentTask && (
              <div className="current-task-section">
                <h3>Current Task</h3>
                <div className="current-task-card">
                  <div className="task-header">
                    <h4>{currentTask.title}</h4>
                    <div className="task-badges">
                      <span 
                        className="priority-badge" 
                        style={{ color: getPriorityStyles(currentTask.priority || 3).color }}
                      >
                        P{currentTask.priority || 3}
                      </span>
                    </div>
                  </div>
                  {currentTask.description && (
                    <p className="task-description">{currentTask.description}</p>
                  )}
                  {/* Update the complete task button to handle individual permission */}
                  {hasIndividualPermission ? (
                    <button 
                      onClick={() => handleIndividualTaskComplete(currentTask, true)}
                      className="complete-task-button"
                      title="Mark task as completed for you"
                    >
                      <CheckCircle size={20} />
                      Complete Task (Individual)
                    </button>
                  ) : (
                    <button 
                      onClick={handleCompleteCurrentTask}
                      className="complete-task-button"
                      disabled={!hasWritePermission}
                      title={!hasWritePermission ? "You don't have permission to modify this plan" : ""}
                    >
                      <CheckCircle size={20} />
                      Complete Task
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="all-tasks-section">
              <div className="section-header">
                <h3>All Tasks</h3>
                <button 
                  onClick={() => setShowAddTask(true)}
                  className="add-task-button"
                  disabled={isCompleted || !hasWritePermission}
                  title={!hasWritePermission ? "You don't have permission to modify this plan" : "Add task"}
                >
                  <Plus size={16} />
                  Add Task
                </button>
              </div>
              
              {showAddTask && hasWritePermission && (
                <div className="add-task-form">
                  <div className="form-row">
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Task title..."
                      className="task-title-input"
                      autoFocus
                    />
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                      className="task-priority-select"
                    >
                      {priorityOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description (optional)..."
                    className="task-description-input"
                    rows="2"
                  />
                  <div className="form-row">
                    <label>
                      <Calendar size={16} />
                      Due Date:
                    </label>
                    <input
                      type="date"
                      value={newTask.date}
                      onChange={(e) => setNewTask(prev => ({ ...prev, date: e.target.value }))}
                      className="task-date-input"
                    />
                  </div>
                  <div className="form-actions">
                    <button onClick={() => setShowAddTask(false)} className="cancel-button">
                      Cancel
                    </button>
                    <button onClick={handleAddTask} className="save-button">
                      Add Task
                    </button>
                  </div>
                </div>
              )}
              <div className="tasks-timeline">
                {tasks.map((task, index) => {
                  const status = getTaskStatus(task, index)
                  const priorityStyles = getPriorityStyles(task.priority || 3)
                  const isEditing = editingTaskId === task.id
                  
                  return (
                    <div key={task.id || index} className={`timeline-task ${status}`}>
                      <div className="timeline-marker">
                        {status === 'completed' ? (
                          <CheckCircle size={20} className="completed-icon" />
                        ) : status === 'current' ? (
                          <Circle size={20} className="current-icon" />
                        ) : (
                          <Circle size={20} className="pending-icon" />
                        )}
                      </div>
                      
                      <div className="timeline-content">
                        {isEditing ? (
                          <div className="edit-task-form">
                            <div className="form-row">
                              <input
                                type="text"
                                value={editingTask.title}
                                onChange={(e) => setEditingTask(prev => ({ ...prev, title: e.target.value }))}
                                className="task-title-input"
                                autoFocus
                              />
                              <select
                                value={editingTask.priority}
                                onChange={(e) => setEditingTask(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                                className="task-priority-select"
                              >
                                {priorityOptions.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <textarea
                              value={editingTask.description || ''}
                              onChange={(e) => setEditingTask(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Task description (optional)..."
                              className="task-description-input"
                              rows="2"
                            />
                            <div className="form-row">
                              <label>
                                <Calendar size={16} />
                                Date:
                              </label>
                              <input
                                type="date"
                                value={editingTask.date}
                                onChange={(e) => setEditingTask(prev => ({ ...prev, date: e.target.value }))}
                                className="task-date-input"
                              />
                            </div>
                            <div className="form-actions">
                              <button onClick={handleCancelEdit} className="cancel-button">
                                Cancel
                              </button>
                              <button onClick={handleSaveTask} className="save-button">
                                <Save size={16} />
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="timeline-task-card"
                            style={{
                              borderLeft: `4px solid ${priorityStyles.color}`,
                              backgroundColor: status === 'completed' ? 
                                'rgba(34, 197, 94, 0.1)' : 
                                status === 'current' ? 
                                  priorityStyles.backgroundColor : 
                                  'rgba(107, 114, 128, 0.1)'
                            }}
                          >
                            <div className="task-header">
                              <h5 className={status === 'completed' ? 'completed-text' : ''}>
                                {task.title}
                              </h5>
                              <div className="task-actions">
                                <span 
                                  className="priority-badge" 
                                  style={{ 
                                    color: status === 'completed' ? '#22c55e' : priorityStyles.color 
                                  }}
                                >
                                  P{task.priority || 3}
                                </span>
                                {/* Add individual task completion checkbox */}
                                {hasIndividualPermission && (
                                  <input
                                    type="checkbox"
                                    checked={task.completed || false}
                                    onChange={(e) => handleIndividualTaskComplete(task, e.target.checked)}
                                    className="individual-task-checkbox"
                                    title="Mark task as completed for you"
                                  />
                                )}
                                {status !== 'completed' && hasWritePermission && (
                                  <>
                                    <button
                                      onClick={() => handleEditTask(task)}
                                      className="edit-task-button"
                                      title="Edit task"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="delete-task-button"
                                      title="Delete task"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {task.description && (
                              <p className={`task-description ${status === 'completed' ? 'completed-text' : ''}`}>
                                {task.description}
                              </p>
                            )}
                            {task.date !== plan.date && (
                              <div className="task-date-info">
                                <Calendar size={14} />
                                <span>Due: {format(parseDateSafely(task.date), 'MMM d, yyyy')}</span>
                              </div>
                            )}
                            {status === 'current' && (
                              <div className="current-task-indicator">
                                → Current Task
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {isCompleted && (
              <div className="completion-celebration">
                <div className="celebration-content">
                  <h3>🎉 Plan Completed!</h3>
                  <p>Congratulations! You've finished all tasks in this plan.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showShareModal && (
        <SharePlanModal 
          plan={plan} 
          onClose={() => setShowShareModal(false)}
          onShareSuccess={handleShareSuccess}
        />
      )}
    </>
  )
}

export default PlanDetailModal