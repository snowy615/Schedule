const express = require('express');
const Task = require('../models/Task');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all tasks for the current user
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.findByUserId(req.user.id);
    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tasks for a specific date
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const tasks = await Task.findByUserAndDate(req.user.id, date);
    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { title, description, date, start_time, finish_time } = req.body;

    // Validate required fields
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    // Validate time formats if provided (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (start_time && !timeRegex.test(start_time)) {
      return res.status(400).json({ error: 'Start time must be in HH:MM format' });
    }
    if (finish_time && !timeRegex.test(finish_time)) {
      return res.status(400).json({ error: 'Finish time must be in HH:MM format' });
    }

    // Validate that finish_time is after start_time if both are provided
    if (start_time && finish_time && start_time >= finish_time) {
      return res.status(400).json({ error: 'Finish time must be after start time' });
    }

    const task = await Task.create(req.user.id, {
      title,
      description,
      date,
      start_time,
      finish_time
    });

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if task belongs to current user
    if (task.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task
router.put('/:id', async (req, res) => {
  try {
    const { title, description, date, start_time, finish_time, completed } = req.body;
    const updates = {};

    // Only include provided fields in updates
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (date !== undefined) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
      }
      updates.date = date;
    }
    if (start_time !== undefined) {
      // Validate start_time format if provided
      if (start_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(start_time)) {
        return res.status(400).json({ error: 'Start time must be in HH:MM format' });
      }
      updates.start_time = start_time;
    }
    if (finish_time !== undefined) {
      // Validate finish_time format if provided
      if (finish_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(finish_time)) {
        return res.status(400).json({ error: 'Finish time must be in HH:MM format' });
      }
      updates.finish_time = finish_time;
    }
    if (completed !== undefined) updates.completed = completed ? 1 : 0;

    // Validate time relationship if both times are being updated
    const currentStartTime = start_time !== undefined ? start_time : null;
    const currentFinishTime = finish_time !== undefined ? finish_time : null;
    if (currentStartTime && currentFinishTime && currentStartTime >= currentFinishTime) {
      return res.status(400).json({ error: 'Finish time must be after start time' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const task = await Task.update(req.params.id, req.user.id, updates);
    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    if (error.message === 'Task not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle task completion
router.patch('/:id/toggle', async (req, res) => {
  try {
    const task = await Task.toggleComplete(req.params.id, req.user.id);
    res.json({
      message: 'Task completion toggled successfully',
      task
    });
  } catch (error) {
    if (error.message === 'Task not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Toggle task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task
router.delete('/:id', async (req, res) => {
  try {
    await Task.delete(req.params.id, req.user.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    if (error.message === 'Task not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;