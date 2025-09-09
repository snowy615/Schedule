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
    const planData = req.body;
    const plan = await Plan.create(req.user.id, planData);
    res.status(201).json({ plan });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific plan with its tasks
router.get('/:id', async (req, res) => {
  try {
    // Use findByUserId to get the plan with shared information
    const plans = await Plan.findByUserId(req.user.id);
    const plan = plans.find(p => p.id == req.params.id);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
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
    const task = await Plan.getCurrentTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Current task not found' });
    }
    res.json({ task });
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

// Set individual task completion status
router.patch('/:id/tasks/:taskId/individual-complete', async (req, res) => {
  try {
    const { completed } = req.body;
    
    // Verify the user has individual permission for this plan
    const db = require('../database').getDB();
    db.get(`
      SELECT sp.permissions
      FROM shared_plans sp
      JOIN plans p ON sp.plan_id = p.id
      WHERE sp.plan_id = ? AND sp.shared_with_user_id = ? AND p.user_id != ?
    `, [req.params.id, req.user.id, req.user.id], async (err, sharedPlan) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!sharedPlan || sharedPlan.permissions !== 'individual') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // Verify that the task belongs to the plan
      db.get(`
        SELECT id FROM tasks 
        WHERE id = ? AND plan_id = ?
      `, [req.params.taskId, req.params.id], async (taskErr, task) => {
        if (taskErr) {
          console.error('Database error:', taskErr);
          return res.status(500).json({ error: 'Internal server error' });
        }
        
        if (!task) {
          return res.status(404).json({ error: 'Task not found in this plan' });
        }
        
        // Set individual task status
        const result = await Plan.setIndividualTaskStatus(req.params.taskId, req.user.id, completed);
        
        // Re-fetch the plan with updated individual task statuses
        const plans = await Plan.findByUserId(req.user.id);
        const updatedPlan = plans.find(p => p.id == req.params.id);
        
        res.json({
          message: `Task ${completed ? 'completed' : 'uncompleted'} successfully`,
          taskStatus: result,
          plan: updatedPlan
        });
      });
    });
  } catch (error) {
    console.error('Set individual task status error:', error);
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
    const { id: planId } = req.params;
    const taskData = req.body;
    const updatedPlan = await Plan.addTask(planId, req.user.id, taskData);
    res.status(201).json({ plan: updatedPlan });
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
    const { id: planId, taskId } = req.params;
    const updates = req.body;
    const updatedPlan = await Plan.updateTask(planId, taskId, req.user.id, updates);
    res.json({ plan: updatedPlan });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized' || 
        error.message === 'Task not found or does not belong to plan') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Update plan task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task from a plan
router.delete('/:id/tasks/:taskId', async (req, res) => {
  try {
    const { id: planId, taskId } = req.params;
    const updatedPlan = await Plan.deleteTask(planId, taskId, req.user.id);
    res.json({ plan: updatedPlan });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized' || 
        error.message === 'Task not found or does not belong to plan' ||
        error.message === 'Cannot delete task: plan must have at least one task') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Delete plan task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Share a plan with another user
router.post('/:id/share', async (req, res) => {
  try {
    const { email, permissions } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user ID by email
    const db = require('../database').getDB();
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Share the plan
      const result = await Plan.sharePlan(
        req.params.id, 
        req.user.id, 
        user.id, 
        permissions || 'read'
      );
      
      res.json(result);
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Cannot share plan with yourself') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Share plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unshare a plan with a user
router.post('/:id/unshare', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get user ID by email
    const db = require('../database').getDB();
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Unshare the plan
      const result = await Plan.unsharePlan(
        req.params.id, 
        req.user.id, 
        user.id
      );
      
      res.json(result);
    });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Unshare plan error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users a plan is shared with
router.get('/:id/shared-users', async (req, res) => {
  try {
    const sharedUsers = await Plan.getSharedUsers(req.params.id, req.user.id);
    res.json({ sharedUsers });
  } catch (error) {
    if (error.message === 'Plan not found or unauthorized') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Get shared users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;