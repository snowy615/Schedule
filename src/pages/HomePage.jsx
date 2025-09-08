import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { Plus, ChevronLeft, ChevronRight, FolderPlus, Edit2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { usePlans } from '../hooks/usePlans'
import TaskModal from '../components/TaskModal'
import PlanModal from '../components/PlanModal'
import PlanDetailModal from '../components/PlanDetailModal'
import { formatDateForAPI, formatDateForAPIWithDelay, parseDateSafely } from '../utils/dateUtils'
import { getPriorityStyles } from '../utils/priorityUtils'
import { formatRepeatType, getRepeatIcon } from '../utils/repeatUtils'
import './HomePage.css'

function HomePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const { tasks, loading, addTask, toggleTask, deleteTask, updateTask } = useTasks()
  const { plans, addPlan, deletePlan, completeCurrentTask, getCurrentTask, addTaskToPlan, updatePlanTask, deletePlanTask } = usePlans()

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + direction)
      return newDate
    })
  }

  const getTasksForDate = (date) => {
    // Only return standalone tasks (not part of any plan)
    return tasks.filter(task => 
      isSameDay(parseDateSafely(task.date), date) && !task.plan_id
    )
  }

  const getPlansForDate = (date) => {
    return plans.filter(plan => {
      // If plan is completed, don't show it
      if (plan.completed) return false
      
      // Show plan on the date of the current task
      if (plan.tasks && plan.tasks.length > 0) {
        const currentTaskIndex = plan.current_task_index || 0
        // Ensure currentTaskIndex is within bounds
        if (currentTaskIndex >= plan.tasks.length) {
          // If current_task_index is out of bounds, use the last task or mark as completed
          return false
        }
        const currentTask = plan.tasks[currentTaskIndex]
        if (currentTask && currentTask.date) {
          return isSameDay(parseDateSafely(currentTask.date), date)
        }
      }
      
      // Fallback to plan date if no current task date
      return isSameDay(parseDateSafely(plan.date), date)
    })
  }

  const handleAddTask = async (taskData) => {
    try {
      await addTask({
        ...taskData,
        date: formatDateForAPI(selectedDate) // Use exact selected date
      })
      setShowTaskModal(false)
    } catch (error) {
      console.error('Failed to add task:', error)
      // Could add error handling UI here
    }
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setSelectedDate(parseDateSafely(task.date))
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
          date: formatDateForAPI(selectedDate)
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

  const handleAddPlan = async (planData) => {
    try {
      await addPlan({
        ...planData,
        date: formatDateForAPI(selectedDate) // Use exact selected date
      })
      setShowPlanModal(false)
    } catch (error) {
      console.error('Failed to add plan:', error)
      // Could add error handling UI here
    }
  }

  const handlePlanClick = async (plan) => {
    try {
      // Get the current task for this plan
      const currentTask = await getCurrentTask(plan.id)
      setSelectedPlan({ ...plan, currentTask })
    } catch (error) {
      console.error('Failed to get plan details:', error)
    }
  }

  const handleCompleteCurrentTask = async (planId) => {
    try {
      const updatedPlan = await completeCurrentTask(planId)
      
      // If plan is not completed and has a next task, navigate to that task's date
      if (updatedPlan && !updatedPlan.completed && updatedPlan.tasks && updatedPlan.tasks.length > 0) {
        const currentTaskIndex = updatedPlan.current_task_index || 0
        const nextTask = updatedPlan.tasks[currentTaskIndex]
        
        if (nextTask && nextTask.date) {
          const nextTaskDate = parseDateSafely(nextTask.date)
          // Navigate calendar to show the date of the next task
          const nextTaskMonth = startOfMonth(nextTaskDate)
          if (!isSameDay(startOfMonth(currentDate), nextTaskMonth)) {
            setCurrentDate(nextTaskDate)
          }
          // Also select that date to highlight it
          setSelectedDate(nextTaskDate)
        }
      }
      
      // Refresh the selected plan if it's currently open
      if (selectedPlan && selectedPlan.id === planId) {
        if (updatedPlan && !updatedPlan.completed) {
          const currentTask = await getCurrentTask(planId)
          setSelectedPlan({ ...updatedPlan, currentTask })
        } else {
          // Plan is completed, close the modal
          setSelectedPlan(null)
        }
      }
    } catch (error) {
      console.error('Failed to complete current task:', error)
    }
  }

  const handleAddTaskToPlan = async (planId, taskData) => {
    try {
      const updatedPlan = await addTaskToPlan(planId, taskData)
      // Refresh the selected plan if it's currently open
      if (selectedPlan && selectedPlan.id === planId) {
        const currentTask = await getCurrentTask(planId)
        setSelectedPlan({ ...updatedPlan, currentTask })
      }
    } catch (error) {
      console.error('Failed to add task to plan:', error)
      throw error
    }
  }

  const handleUpdatePlanTask = async (planId, taskId, updates) => {
    try {
      const updatedPlan = await updatePlanTask(planId, taskId, updates)
      // Refresh the selected plan if it's currently open
      if (selectedPlan && selectedPlan.id === planId) {
        const currentTask = await getCurrentTask(planId)
        setSelectedPlan({ ...updatedPlan, currentTask })
      }
    } catch (error) {
      console.error('Failed to update plan task:', error)
      throw error
    }
  }

  const handleDeletePlanTask = async (planId, taskId) => {
    try {
      const updatedPlan = await deletePlanTask(planId, taskId)
      // Refresh the selected plan if it's currently open
      if (selectedPlan && selectedPlan.id === planId) {
        const currentTask = await getCurrentTask(planId)
        setSelectedPlan({ ...updatedPlan, currentTask })
      }
    } catch (error) {
      console.error('Failed to delete plan task:', error)
      throw error
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
    
    const newDateString = formatDateForAPI(targetDate)
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
        <div className="header-buttons">
          <button 
            onClick={() => setShowTaskModal(true)}
            className="add-task-button"
          >
            <Plus size={20} />
            Add Task
          </button>
          <button 
            onClick={() => setShowPlanModal(true)}
            className="add-plan-button"
          >
            <FolderPlus size={20} />
            Create Plan
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        <div className="weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        <div className="days-grid">
          {calendarDays.map(day => {
            const dayTasks = getTasksForDate(day)
            const dayPlans = getPlansForDate(day)
            const isSelected = isSameDay(day, selectedDate)
            const isTodayDate = isToday(day)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            
            return (
              <div
                key={day.toISOString()}
                className={`calendar-day ${
                  isSelected ? 'selected' : ''
                } ${
                  isTodayDate ? 'today' : ''
                } ${
                  !isCurrentMonth ? 'other-month' : ''
                } ${
                  dragOverDate && isSameDay(dragOverDate, day) ? 'drag-over' : ''
                }`}
                onClick={() => setSelectedDate(day)}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-items">
                  {/* Render Plans */}
                  {dayPlans.slice(0, 2).map(plan => (
                    <div
                      key={`plan-${plan.id}`}
                      className={`plan-indicator ${
                        plan.completed ? 'completed' : ''
                      }`}
                      title={`📋 ${plan.title} (Plan)`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePlanClick(plan)
                      }}
                    >
                      📋 {plan.title.substring(0, 15)}
                      {plan.title.length > 15 ? '...' : ''}
                    </div>
                  ))}
                  
                  {/* Render Tasks */}
                  {dayTasks.slice(0, 3 - dayPlans.length).map(task => {
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
                        title={`${task.title} (${task.priority ? `P${task.priority}` : 'P3'}${task.repeat_type && task.repeat_type !== 'none' ? ` - ${formatRepeatType(task.repeat_type)}` : ''})`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      >
                        {getRepeatIcon(task.repeat_type)} {task.title.substring(0, 18)}
                        {task.title.length > 18 ? '...' : ''}
                      </div>
                    )
                  })}
                  
                  {(dayTasks.length + dayPlans.length) > 3 && (
                    <div className="more-items">+{(dayTasks.length + dayPlans.length) - 3} more</div>
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
            <p>Loading items...</p>
          </div>
        ) : (
          <div className="items-list">
            {getPlansForDate(selectedDate).length === 0 && getTasksForDate(selectedDate).length === 0 ? (
              <p className="no-items">No tasks or plans for this day</p>
            ) : (
              <>
                {/* Render Plans */}
                {getPlansForDate(selectedDate).map(plan => (
                  <div 
                    key={`plan-${plan.id}`} 
                    className={`plan-item ${
                      plan.completed ? 'completed' : ''
                    }`}
                    onClick={() => handlePlanClick(plan)}
                  >
                    <div className="plan-content">
                      <div className="plan-header-info">
                        <h4>📋 {plan.title}</h4>
                        <div className="plan-badges">
                          <span className="plan-badge">
                            Plan ({plan.completed ? 'Complete' : 'In Progress'})
                          </span>
                        </div>
                      </div>
                      {plan.description && <p>{plan.description}</p>}
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePlan(plan.id)
                      }}
                      className="delete-button"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {/* Render Tasks */}
                {getTasksForDate(selectedDate).map(task => {
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
                          <h4>{getRepeatIcon(task.repeat_type)} {task.title}</h4>
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
                        {task.description && <p>{task.description}</p>}
                        {task.repeat_type && task.repeat_type !== 'none' && (
                          <div className="repeat-info">
                            <small>Repeats: {formatRepeatType(task.repeat_type)}
                              {task.repeat_until && ` until ${new Date(task.repeat_until).toLocaleDateString()}`}
                            </small>
                          </div>
                        )}
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
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          onClose={handleCloseTaskModal}
          onSave={handleSaveTask}
          selectedDate={selectedDate}
          task={editingTask}
          isEditing={!!editingTask}
        />
      )}

      {showPlanModal && (
        <PlanModal
          onClose={() => setShowPlanModal(false)}
          onSave={handleAddPlan}
          selectedDate={selectedDate}
        />
      )}

      {selectedPlan && (
        <PlanDetailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onCompleteTask={() => handleCompleteCurrentTask(selectedPlan.id)}
          onAddTask={handleAddTaskToPlan}
          onUpdateTask={handleUpdatePlanTask}
          onDeleteTask={handleDeletePlanTask}
        />
      )}
    </div>
  )
}

export default HomePage