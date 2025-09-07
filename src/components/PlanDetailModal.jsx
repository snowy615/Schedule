import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, CheckCircle, Circle } from 'lucide-react'
import { getPriorityStyles } from '../utils/priorityUtils'
import './PlanDetailModal.css'

function PlanDetailModal({ plan, onClose, onCompleteTask }) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(plan.current_task_index || 0)
  const [tasks, setTasks] = useState(plan.tasks || [])

  useEffect(() => {
    if (plan.tasks) {
      setTasks(plan.tasks)
      setCurrentTaskIndex(plan.current_task_index || 0)
    }
  }, [plan])

  const currentTask = tasks[currentTaskIndex]
  const isCompleted = plan.completed || currentTaskIndex >= tasks.length

  const handleCompleteCurrentTask = () => {
    if (!isCompleted && currentTask) {
      onCompleteTask()
      // Optimistically update UI
      setTasks(prev => 
        prev.map((task, index) => 
          index === currentTaskIndex ? { ...task, completed: true } : task
        )
      )
      setCurrentTaskIndex(prev => prev + 1)
    }
  }

  const getTaskStatus = (task, index) => {
    if (index < currentTaskIndex) return 'completed'
    if (index === currentTaskIndex && !isCompleted) return 'current'
    return 'pending'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plan-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 {plan.title}</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-date">
          <span>Date: {format(new Date(plan.date), 'EEEE, MMMM d, yyyy')}</span>
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
                <span className="completed-count">{currentTaskIndex}</span>
                <span className="separator">/</span>
                <span className="total-count">{tasks.length}</span>
                <span className="progress-label">tasks completed</span>
              </div>
            </div>
            
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTaskIndex / tasks.length) * 100}%` }}
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
                <button 
                  onClick={handleCompleteCurrentTask}
                  className="complete-task-button"
                >
                  <CheckCircle size={20} />
                  Complete Task
                </button>
              </div>
            </div>
          )}

          <div className="all-tasks-section">
            <h3>All Tasks</h3>
            <div className="tasks-timeline">
              {tasks.map((task, index) => {
                const status = getTaskStatus(task, index)
                const priorityStyles = getPriorityStyles(task.priority || 3)
                
                return (
                  <div key={index} className={`timeline-task ${status}`}>
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
                          <span 
                            className="priority-badge" 
                            style={{ 
                              color: status === 'completed' ? '#22c55e' : priorityStyles.color 
                            }}
                          >
                            P{task.priority || 3}
                          </span>
                        </div>
                        {task.description && (
                          <p className={`task-description ${status === 'completed' ? 'completed-text' : ''}`}>
                            {task.description}
                          </p>
                        )}
                        {status === 'current' && (
                          <div className="current-task-indicator">
                            → Current Task
                          </div>
                        )}
                      </div>
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
  )
}

export default PlanDetailModal