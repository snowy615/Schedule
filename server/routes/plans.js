const express = require('express');
const Plan = require('../models/Plan');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all plans for the current user
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.findByUserId(req.user.id);
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get plans for a specific date
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const plans = await Plan.findByUserAndDate(req.user.id, date);
    res.json({ plans });
  } catch (error) {
    console.error('Get plans by date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new plan
router.post('/', async (req, res) => {
  try {
    const { title, description, date, tasks } = req.body;

    // Validate required fields
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
    }

    // Validate tasks array
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'At least one task is required for a plan' });
    }

    // Validate each task
    for (const task of tasks) {
      if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
        return res.status(400).json({ error: 'Each task must have a valid title' });
      }
      
      if (task.priority !== undefined && (task.priority < 1 || task.priority > 5 || !Number.isInteger(task.priority))) {
        return res.status(400).json({ error: 'Task priority must be an integer between 1 and 5' });
      }
    }

    const plan = await Plan.create(req.user.id, {
      title,
      description,
      date,
      tasks
    });

    res.status(201).json({
      message: 'Plan created successfully',
      plan
    });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific plan with its tasks
router.get('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if plan belongs to current user
    if (plan.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ plan });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current active task for a plan
router.get('/:id/current-task', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if plan belongs to current user
    if (plan.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const currentTask = await Plan.getCurrentTask(req.params.id);
    res.json({ task: currentTask });
  } catch (error) {
    console.error('Get current task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete current task and move to next
router.patch('/:id/complete-task', async (req, res) => {
  try {
    const updatedPlan = await Plan.completeCurrentTask(req.params.id, req.user.id);
    res.json({
      message: 'Task completed successfully',
      plan: updatedPlan
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized' || 
        error.message === 'Current task not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Complete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a plan
router.delete('/:id', async (req, res) => {
  try {
    await Plan.delete(req.params.id, req.user.id);
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a task to a plan
router.post('/:id/tasks', async (req, res) => {
  try {
    const { title, description, priority, date } = req.body;
    
    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    
    if (priority !== undefined && (priority < 1 || priority > 5 || !Number.isInteger(priority))) {
      return res.status(400).json({ error: 'Priority must be an integer between 1 and 5' });
    }
    
    if (date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
      }
    }
    
    const updatedPlan = await Plan.addTask(req.params.id, req.user.id, {
      title: title.trim(),
      description: description ? description.trim() : null,
      priority: priority || 3,
      date: date
    });
    
    res.status(201).json({
      message: 'Task added successfully',
      plan: updatedPlan
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Add task to plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a task in a plan
router.put('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { title, description, priority, date } = req.body;
    
    // Validate fields if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return res.status(400).json({ error: 'Task title cannot be empty' });
    }
    
    if (priority !== undefined && (priority < 1 || priority > 5 || !Number.isInteger(priority))) {
      return res.status(400).json({ error: 'Priority must be an integer between 1 and 5' });
    }
    
    if (date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format' });
      }
    }
    
    const updatedPlan = await Plan.updateTask(req.params.id, req.params.taskId, req.user.id, {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description ? description.trim() : null }),
      ...(priority !== undefined && { priority }),
      ...(date !== undefined && { date })
    });
    
    res.json({
      message: 'Task updated successfully',
      plan: updatedPlan
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized' || 
        error.message === 'Task not found or does not belong to plan') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update task in plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task from a plan
router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const updatedPlan = await Plan.deleteTask(req.params.id, req.params.taskId, req.user.id);
    res.json({
      message: 'Task deleted successfully',
      plan: updatedPlan
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized' || 
        error.message === 'Task not found or does not belong to plan' ||
        error.message === 'Cannot delete task: plan must have at least one task') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete task from plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;