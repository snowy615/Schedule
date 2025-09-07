import { useState } from 'react'
import { format } from 'date-fns'
import { X, Plus, Trash2 } from 'lucide-react'
import './PlanModal.css'

function PlanModal({ onClose, onSave, selectedDate }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tasks: [{ title: '', description: '', priority: 3 }]
  })

  const priorityOptions = [
    { value: 1, label: 'P1 - Urgent', color: '#dc2626' },
    { value: 2, label: 'P2 - High', color: '#ea580c' },
    { value: 3, label: 'P3 - Medium', color: '#2563eb' },
    { value: 4, label: 'P4 - Low', color: '#16a34a' },
    { value: 5, label: 'P5 - Very Low', color: '#6b7280' }
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return
    
    // Filter out empty tasks
    const validTasks = formData.tasks.filter(task => task.title.trim() !== '')
    if (validTasks.length === 0) return
    
    onSave({
      ...formData,
      tasks: validTasks
    })
    setFormData({ title: '', description: '', tasks: [{ title: '', description: '', priority: 3 }] })
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTaskChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      tasks: prev.tasks.map((task, i) => 
        i === index ? { ...task, [field]: value } : task
      )
    }))
  }

  const addTask = () => {
    setFormData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { title: '', description: '', priority: 3 }]
    }))
  }

  const removeTask = (index) => {
    if (formData.tasks.length > 1) {
      setFormData(prev => ({
        ...prev,
        tasks: prev.tasks.filter((_, i) => i !== index)
      }))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content plan-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Plan</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-date">
          <span>Date: {format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
        </div>

        <form onSubmit={handleSubmit} className="plan-form">
          <div className="form-group">
            <label htmlFor="plan-title">Plan Title *</label>
            <input
              id="plan-title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter plan title..."
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="plan-description">Plan Description</label>
            <textarea
              id="plan-description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add a description for your plan (optional)..."
              rows="2"
            />
          </div>

          <div className="tasks-section">
            <div className="tasks-header">
              <h3>Tasks in Plan</h3>
              <button type="button" onClick={addTask} className="add-task-btn">
                <Plus size={16} />
                Add Task
              </button>
            </div>

            <div className="tasks-list">
              {formData.tasks.map((task, index) => (
                <div key={index} className="task-form-item">
                  <div className="task-form-header">
                    <span className="task-number">Task {index + 1}</span>
                    {formData.tasks.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeTask(index)}
                        className="remove-task-btn"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="task-form-fields">
                    <div className="form-group">
                      <label htmlFor={`task-title-${index}`}>Task Title *</label>
                      <input
                        id={`task-title-${index}`}
                        type="text"
                        value={task.title}
                        onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                        placeholder="Enter task title..."
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`task-description-${index}`}>Task Description</label>
                      <textarea
                        id={`task-description-${index}`}
                        value={task.description}
                        onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                        placeholder="Add task description (optional)..."
                        rows="2"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`task-priority-${index}`}>Priority</label>
                      <select
                        id={`task-priority-${index}`}
                        value={task.priority}
                        onChange={(e) => handleTaskChange(index, 'priority', parseInt(e.target.value))}
                        className="priority-select"
                      >
                        {priorityOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button">
              Create Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PlanModal