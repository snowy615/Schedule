import { useState } from 'react'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import './TaskModal.css'

function TaskModal({ onClose, onSave, selectedDate }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    time: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return
    
    onSave(formData)
    setFormData({ title: '', description: '', time: '' })
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Task</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-date">
          <span>Date: {format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group">
            <label htmlFor="title">Task Title *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter task title..."
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Add a description (optional)..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="time">Time</label>
            <input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => handleChange('time', e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskModal