import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { X, Link, FileText, Upload } from 'lucide-react'
import { REPEAT_OPTIONS } from '../utils/repeatUtils'
import './TaskModal.css'

function TaskModal({ onClose, onSave, selectedDate, task = null, isEditing = false }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    finish_time: '',
    priority: 3,
    repeat_type: 'none',
    repeat_until: '',
    attachments: '' // New field for attachments
  })

  // Initialize form data when editing
  useEffect(() => {
    if (isEditing && task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        start_time: task.start_time || '',
        finish_time: task.finish_time || '',
        priority: task.priority || 3,
        repeat_type: task.repeat_type || 'none',
        repeat_until: task.repeat_until || '',
        attachments: task.attachments || '' // Initialize attachments
      })
    }
  }, [isEditing, task])

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
    
    if (isEditing) {
      onSave(task.id, formData)
    } else {
      onSave(formData)
    }
    
    if (!isEditing) {
      setFormData({ 
        title: '', 
        description: '', 
        start_time: '', 
        finish_time: '', 
        priority: 3, 
        repeat_type: 'none', 
        repeat_until: '',
        attachments: ''
      })
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle file upload (simulated - in a real app, this would upload to a server)
  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      // In a real application, you would upload the file to a server and get a URL
      // For now, we'll just add a placeholder text
      const fileEntry = `${file.name} (File uploaded - in a real app this would be a link)`;
      setFormData(prev => ({
        ...prev,
        attachments: prev.attachments ? `${prev.attachments}\n${fileEntry}` : fileEntry
      }))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Task' : 'Add New Task'}</h2>
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

          {/* Attachments Section */}
          <div className="form-group">
            <label htmlFor="attachments">
              <FileText size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Attachments, Links & Instructions
            </label>
            <textarea
              id="attachments"
              value={formData.attachments}
              onChange={(e) => handleChange('attachments', e.target.value)}
              placeholder="Add links, instructions, or other notes here...
Example:
- https://example.com/document.pdf
- Meeting notes: Discuss project timeline
- File: project_plan.docx (uploaded)"
              rows="4"
            />
            <div className="attachment-actions">
              <label className="file-upload-label">
                <Upload size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                Upload File
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="file-input"
                  accept="*/*"
                />
              </label>
              <small className="field-hint">
                Add links, file names, or instructions. Files are simulated in this demo.
              </small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="start_time">Start Time</label>
            <input
              id="start_time"
              type="time"
              value={formData.start_time}
              onChange={(e) => handleChange('start_time', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="finish_time">Finish Time</label>
            <input
              id="finish_time"
              type="time"
              value={formData.finish_time}
              onChange={(e) => handleChange('finish_time', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value))}
              className="priority-select"
            >
              {priorityOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="repeat_type">Repeat</label>
            <select
              id="repeat_type"
              value={formData.repeat_type}
              onChange={(e) => handleChange('repeat_type', e.target.value)}
              className="repeat-select"
            >
              {REPEAT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {formData.repeat_type !== 'none' && (
            <div className="form-group">
              <label htmlFor="repeat_until">Repeat Until (optional)</label>
              <input
                id="repeat_until"
                type="date"
                value={formData.repeat_until}
                onChange={(e) => handleChange('repeat_until', e.target.value)}
                className="date-input"
                min={format(selectedDate, 'yyyy-MM-dd')}
              />
              <small className="field-hint">Leave empty to repeat indefinitely</small>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button">
              {isEditing ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TaskModal