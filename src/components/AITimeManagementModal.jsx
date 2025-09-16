import { useState, useEffect } from 'react'
import { Brain, X, Clock, Calendar, CheckCircle, AlertTriangle } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { usePlans } from '../hooks/usePlans'
import { suggestTimeBlocks } from '../utils/aiTimeManagement'
import './AITimeManagementModal.css'

function AITimeManagementModal({ onClose, onSave }) {
  const { tasks, updateTask } = useTasks()
  const { plans, updatePlanTask } = usePlans()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        console.log('Loading suggestions with tasks:', tasks);
        console.log('Loading suggestions with plans:', plans);
        setLoading(true);
        const suggestedTasks = await suggestTimeBlocks(tasks, plans);
        console.log('Suggestions loaded:', suggestedTasks);
        setSuggestions(suggestedTasks);
      } catch (error) {
        console.error('Error loading suggestions:', error);
        alert('Failed to load time suggestions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [tasks, plans])

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      console.log('Applying all suggestions:', suggestions);
      // Apply all suggestions
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      for (const task of suggestions) {
        if (task.suggested_start_time && task.suggested_finish_time) {
          try {
            console.log(`Applying suggestion for ${task.type} ${task.id}:`, {
              start_time: task.suggested_start_time,
              finish_time: task.suggested_finish_time
            });
            
            if (task.type === 'task') {
              // Update regular task
              console.log('Calling updateTask with:', task.id, {
                start_time: task.suggested_start_time,
                finish_time: task.suggested_finish_time,
                date: task.date // Also update the date if it was moved to today
              });
              await updateTask(task.id, {
                start_time: task.suggested_start_time,
                finish_time: task.suggested_finish_time,
                date: task.date // Update date if it was moved to today
              });
              successCount++;
              console.log(`Successfully updated task ${task.id}`);
            } else if (task.type === 'plan_task' && task.plan_id) {
              // Update plan task
              console.log('Calling updatePlanTask with:', task.plan_id, task.id, {
                start_time: task.suggested_start_time,
                finish_time: task.suggested_finish_time
              });
              await updatePlanTask(task.plan_id, task.id, {
                start_time: task.suggested_start_time,
                finish_time: task.suggested_finish_time
              });
              successCount++;
              console.log(`Successfully updated plan task ${task.id} in plan ${task.plan_id}`);
            } else {
              console.warn('Skipping task due to missing type or plan_id:', task);
            }
          } catch (error) {
            console.error(`Error applying suggestion for task ${task.id}:`, error);
            errors.push({
              taskId: task.id,
              taskTitle: task.title,
              taskType: task.type,
              planId: task.plan_id,
              error: error.message || 'Unknown error'
            });
            errorCount++;
          }
        }
      }
      
      // Show detailed results
      if (errorCount > 0) {
        let errorMessage = `Applied time suggestions to ${successCount} tasks. Failed to apply to ${errorCount} tasks.\n\nErrors:\n`;
        errors.forEach((err, index) => {
          errorMessage += `${index + 1}. ${err.taskTitle} (${err.taskId}) [${err.taskType}${err.planId ? ', plan: ' + err.planId : ''}]: ${err.error}\n`;
        });
        alert(errorMessage);
      } else if (successCount > 0) {
        alert(`Successfully applied time suggestions to ${successCount} tasks!`);
      } else {
        alert('No time suggestions were applied.');
      }
      
      // Call onSave callback if provided
      if (onSave) {
        onSave();
      }
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('Error applying suggestions:', error);
      alert('Failed to apply time suggestions. Please try again.');
    } finally {
      setApplying(false);
    }
  }

  const handleApplySingle = async (task) => {
    try {
      console.log('Applying single suggestion:', task);
      if (task.suggested_start_time && task.suggested_finish_time) {
        if (task.type === 'task') {
          // Update regular task
          console.log('Calling updateTask with:', task.id, {
            start_time: task.suggested_start_time,
            finish_time: task.suggested_finish_time,
            date: task.date // Also update the date if it was moved to today
          });
          await updateTask(task.id, {
            start_time: task.suggested_start_time,
            finish_time: task.suggested_finish_time,
            date: task.date // Update date if it was moved to today
          });
          alert('Time suggestion applied successfully!');
        } else if (task.type === 'plan_task' && task.plan_id) {
          // Update plan task
          console.log('Calling updatePlanTask with:', task.plan_id, task.id, {
            start_time: task.suggested_start_time,
            finish_time: task.suggested_finish_time
          });
          await updatePlanTask(task.plan_id, task.id, {
            start_time: task.suggested_start_time,
            finish_time: task.suggested_finish_time
          });
          alert('Time suggestion applied successfully!');
        } else {
          alert('Cannot apply suggestion: missing task type or plan information.');
          return;
        }
        
        // Remove the task from suggestions
        setSuggestions(prev => prev.filter(t => t.id !== task.id));
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
      alert(`Failed to apply time suggestion: ${error.message || 'Unknown error'}. Please try again.`);
    }
  }

  const formatTime = (time) => {
    if (!time) return 'No time set'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Separate different types of tasks for better organization
  const overdueTasks = suggestions.filter(task => task.is_overdue);
  const todayTasks = suggestions.filter(task => !task.is_overdue);

  return (
    <div className="ai-time-modal-overlay">
      <div className="ai-time-modal">
        <div className="ai-time-modal-header">
          <div className="ai-time-modal-title">
            <Brain size={24} />
            <h2>AI Time Management</h2>
          </div>
          <button className="ai-time-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="ai-time-modal-content">
          {loading ? (
            <div className="ai-time-loading">
              <div className="loading-spinner"></div>
              <p>Analyzing your schedule...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="ai-time-no-suggestions">
              <CheckCircle size={48} />
              <h3>All Set!</h3>
              <p>All your tasks and plan activities already have time slots assigned.</p>
            </div>
          ) : (
            <>
              <div className="ai-time-summary">
                <p>AI has found {suggestions.length} activities that could use time suggestions:</p>
              </div>
              
              {/* Overdue Tasks Section */}
              {overdueTasks.length > 0 && (
                <div className="ai-time-section">
                  <div className="ai-time-section-header">
                    <AlertTriangle size={20} />
                    <h3>Overdue Tasks ({overdueTasks.length})</h3>
                  </div>
                  <div className="ai-time-suggestions-list">
                    {overdueTasks.map((task, index) => (
                      <div key={`${task.type}-${task.id}`} className="ai-time-suggestion-item overdue-task">
                        <div className="ai-time-suggestion-info">
                          <div className="ai-time-suggestion-title">
                            <h4>{task.title}</h4>
                            {task.type === 'plan_task' && (
                              <span className="ai-time-plan-tag">Plan: {task.plan_title}</span>
                            )}
                          </div>
                          
                          <div className="ai-time-suggestion-details">
                            {/* Add explicit task type and status information */}
                            <div className="ai-time-task-identification">
                              Overdue {task.type === 'plan_task' ? 'Plan Task' : 'Task'}: {task.title}
                            </div>
                            
                            <div className="ai-time-suggestion-date">
                              <Calendar size={16} />
                              <span>
                                {task.originalDate ? `Originally due: ${task.originalDate}` : `Due: ${task.date}`}
                                {task.date !== (task.originalDate || task.date) ? ' (Moved to today)' : ''}
                              </span>
                            </div>
                            
                            {task.suggested_start_time && task.suggested_finish_time ? (
                              <div className="ai-time-suggestion-time">
                                <Clock size={16} />
                                <span>
                                  {formatTime(task.suggested_start_time)} - {formatTime(task.suggested_finish_time)}
                                </span>
                              </div>
                            ) : (
                              <div className="ai-time-suggestion-no-time">
                                <span>No suitable time slot available</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {task.suggested_start_time && task.suggested_finish_time && (
                          <div className="ai-time-suggestion-actions">
                            <button 
                              className="ai-time-apply-button"
                              onClick={() => handleApplySingle(task)}
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Today's Tasks Section */}
              {todayTasks.length > 0 && (
                <div className="ai-time-section">
                  <div className="ai-time-section-header">
                    <Clock size={20} />
                    <h3>Today's Tasks ({todayTasks.length})</h3>
                  </div>
                  <div className="ai-time-suggestions-list">
                    {todayTasks.map((task, index) => (
                      <div key={`${task.type}-${task.id}`} className="ai-time-suggestion-item">
                        <div className="ai-time-suggestion-info">
                          <div className="ai-time-suggestion-title">
                            <h4>{task.title}</h4>
                            {task.type === 'plan_task' && (
                              <span className="ai-time-plan-tag">Plan: {task.plan_title}</span>
                            )}
                          </div>
                          
                          <div className="ai-time-suggestion-details">
                            {/* Add explicit task type and status information */}
                            <div className="ai-time-task-identification">
                              {task.type === 'plan_task' ? 'Plan Task' : 'Task'}: {task.title}
                            </div>
                            
                            <div className="ai-time-suggestion-date">
                              <Calendar size={16} />
                              <span>{task.date}</span>
                            </div>
                            
                            {task.suggested_start_time && task.suggested_finish_time ? (
                              <div className="ai-time-suggestion-time">
                                <Clock size={16} />
                                <span>
                                  {formatTime(task.suggested_start_time)} - {formatTime(task.suggested_finish_time)}
                                </span>
                              </div>
                            ) : (
                              <div className="ai-time-suggestion-no-time">
                                <span>No suitable time slot available</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {task.suggested_start_time && task.suggested_finish_time && (
                          <div className="ai-time-suggestion-actions">
                            <button 
                              className="ai-time-apply-button"
                              onClick={() => handleApplySingle(task)}
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {suggestions.length > 0 && (
          <div className="ai-time-modal-footer">
            <button 
              className="ai-time-apply-all-button"
              onClick={handleApplyAll}
              disabled={applying}
            >
              {applying ? 'Applying...' : 'Apply All Suggestions'}
            </button>
            <button className="ai-time-cancel-button" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AITimeManagementModal