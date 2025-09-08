const database = require('../database');

class Task {
  // Create a new task
  static async create(userId, taskData) {
    return new Promise((resolve, reject) => {
      const { title, description, date, start_time, finish_time, priority, repeat_type, repeat_interval, repeat_until, parent_task_id, attachments } = taskData;
      const db = database.getDB();
      const stmt = db.prepare(`
        INSERT INTO tasks (user_id, title, description, date, start_time, finish_time, priority, repeat_type, repeat_interval, repeat_until, parent_task_id, attachments) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        userId, 
        title, 
        description || null, 
        date, 
        start_time || null, 
        finish_time || null, 
        priority || 3,
        repeat_type || 'none',
        repeat_interval || 1,
        repeat_until || null,
        parent_task_id || null,
        attachments || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          // Return the created task
          Task.findById(this.lastID).then(resolve).catch(reject);
        }
      });
      stmt.finalize();
    });
  }

  // Find task by ID
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            row.completed = Boolean(row.completed);
          }
          resolve(row);
        }
      });
    });
  }

  // Get all tasks for a user
  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.all(`
        SELECT * FROM tasks 
        WHERE user_id = ? 
        ORDER BY date ASC, start_time ASC, created_at ASC
      `, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert completed from integer to boolean
          const tasks = rows.map(row => ({
            ...row,
            completed: Boolean(row.completed)
          }));
          resolve(tasks);
        }
      });
    });
  }

  // Get tasks for a specific date
  static async findByUserAndDate(userId, date) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.all(`
        SELECT * FROM tasks 
        WHERE user_id = ? AND date = ? 
        ORDER BY time ASC, created_at ASC
      `, [userId, date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const tasks = rows.map(row => ({
            ...row,
            completed: Boolean(row.completed)
          }));
          resolve(tasks);
        }
      });
    });
  }

  // Update a task
  static async update(id, userId, updates) {
    return new Promise((resolve, reject) => {
      const allowedFields = ['title', 'description', 'date', 'start_time', 'finish_time', 'priority', 'repeat_type', 'repeat_interval', 'repeat_until', 'completed', 'attachments'];
      const fields = [];
      const values = [];

      // Build dynamic update query
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (fields.length === 0) {
        reject(new Error('No valid fields to update'));
        return;
      }

      // Add updated_at timestamp
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id, userId);

      const db = database.getDB();
      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
      
      db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Task not found or unauthorized'));
        } else {
          // Check if this update might affect plan completion
          Task.checkAndUpdatePlanCompletion(id)
            .then(() => {
              Task.findById(id).then(resolve).catch(reject);
            })
            .catch(planErr => {
              // Even if plan update fails, still return the updated task
              Task.findById(id).then(resolve).catch(reject);
            });
        }
      });
    });
  }

  // Delete a task
  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Task not found or unauthorized'));
        } else {
          resolve({ message: 'Task deleted successfully' });
        }
      });
    });
  }

  // Toggle task completion status
  static async toggleComplete(id, userId) {
    return new Promise(async (resolve, reject) => {
      const db = database.getDB();
      
      try {
        // First get the current task to check if it's recurring
        const currentTask = await Task.findById(id);
        if (!currentTask || currentTask.user_id !== userId) {
          reject(new Error('Task not found or unauthorized'));
          return;
        }
        
        // Toggle the completion status
        db.run(`
          UPDATE tasks 
          SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND user_id = ?
        `, [id, userId], async function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            reject(new Error('Task not found or unauthorized'));
            return;
          }
          
          try {
            // Get the updated task
            const updatedTask = await Task.findById(id);
            
            // Check if this might affect plan completion
            await Task.checkAndUpdatePlanCompletion(id);
            
            // If the task was just completed and it's a recurring task, generate next occurrence
            if (updatedTask.completed && 
                updatedTask.repeat_type && 
                updatedTask.repeat_type !== 'none') {
              
              // Check if next occurrence already exists
              const nextOccurrenceExists = await Task.checkNextOccurrenceExists(updatedTask);
              
              if (!nextOccurrenceExists) {
                // Generate the next occurrence
                await Task.generateNextOccurrence(updatedTask);
              }
            }
            
            resolve(updatedTask);
          } catch (generateError) {
            console.error('Error generating next occurrence:', generateError);
            // Still resolve with the updated task even if generation fails
            const updatedTask = await Task.findById(id);
            resolve(updatedTask);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Check if next occurrence already exists for a recurring task
Task.checkNextOccurrenceExists = function(task) {
  return new Promise((resolve, reject) => {
    if (!task || task.repeat_type === 'none') {
      resolve(false);
      return;
    }
    
    // Calculate what the next date would be
    const dateComponents = task.date.split('-');
    const currentDate = new Date(parseInt(dateComponents[0]), parseInt(dateComponents[1]) - 1, parseInt(dateComponents[2]));
    let nextDate;
    
    switch (task.repeat_type) {
      case 'daily':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (task.repeat_interval || 1));
        break;
      case 'every_other_day':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 2);
        break;
      case 'every_three_days':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 3);
        break;
      case 'weekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (7 * (task.repeat_interval || 1)));
        break;
      case 'monthly':
        nextDate = new Date(currentDate);
        nextDate.setMonth(currentDate.getMonth() + (task.repeat_interval || 1));
        break;
      case 'yearly':
        nextDate = new Date(currentDate);
        nextDate.setFullYear(currentDate.getFullYear() + (task.repeat_interval || 1));
        break;
      default:
        resolve(false);
        return;
    }
    
    // Check if we should stop generating (past repeat_until date)
    if (task.repeat_until) {
      const untilDate = new Date(task.repeat_until);
      if (nextDate > untilDate) {
        resolve(false); // No next occurrence should exist
        return;
      }
    }
    
    // Format the expected next date
    const nextDateString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    
    // Check if a task already exists for this date with the same parent
    const database = require('../database');
    const db = database.getDB();
    const parentId = task.parent_task_id || task.id;
    
    db.get(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE user_id = ? 
      AND (parent_task_id = ? OR (id = ? AND repeat_type != 'none'))
      AND date = ?
    `, [task.user_id, parentId, parentId, nextDateString], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row.count > 0);
      }
    });
  });
};

// Generate next occurrence for recurring task
Task.generateNextOccurrence = function(parentTask) {
  return new Promise((resolve, reject) => {
    if (!parentTask || parentTask.repeat_type === 'none') {
      resolve(null);
      return;
    }
    
    // Calculate next date based on repeat type
    const dateComponents = parentTask.date.split('-');
    const currentDate = new Date(parseInt(dateComponents[0]), parseInt(dateComponents[1]) - 1, parseInt(dateComponents[2]));
    let nextDate;
    
    switch (parentTask.repeat_type) {
      case 'daily':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (parentTask.repeat_interval || 1));
        break;
        
      case 'every_other_day':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 2);
        break;
        
      case 'every_three_days':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + 3);
        break;
        
      case 'weekly':
        nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (7 * (parentTask.repeat_interval || 1)));
        break;
        
      case 'monthly':
        nextDate = new Date(currentDate);
        nextDate.setMonth(currentDate.getMonth() + (parentTask.repeat_interval || 1));
        break;
        
      case 'yearly':
        nextDate = new Date(currentDate);
        nextDate.setFullYear(currentDate.getFullYear() + (parentTask.repeat_interval || 1));
        break;
        
      default:
        resolve(null);
        return;
    }
    
    // Check if we should stop generating (past repeat_until date)
    if (parentTask.repeat_until) {
      const untilDate = new Date(parentTask.repeat_until);
      if (nextDate > untilDate) {
        resolve(null);
        return;
      }
    }
    
    // Format date for API
    const nextDateString = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    
    // Create new task instance
    const nextTaskData = {
      title: parentTask.title,
      description: parentTask.description,
      date: nextDateString,
      start_time: parentTask.start_time,
      finish_time: parentTask.finish_time,
      priority: parentTask.priority,
      repeat_type: parentTask.repeat_type,
      repeat_interval: parentTask.repeat_interval,
      repeat_until: parentTask.repeat_until,
      parent_task_id: parentTask.parent_task_id || parentTask.id
    };
    
    Task.create(parentTask.user_id, nextTaskData).then(resolve).catch(reject);
  });
};

// Find recurring tasks that need next occurrence generated
Task.findRecurringTasksNeedingGeneration = function(userId, daysAhead = 30) {
  return new Promise((resolve, reject) => {
    const database = require('../database');
    const db = database.getDB();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const futureDateString = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    
    db.all(`
      SELECT * FROM tasks 
      WHERE user_id = ? 
      AND repeat_type != 'none' 
      AND (repeat_until IS NULL OR repeat_until >= date('now'))
      AND date <= ?
      ORDER BY date ASC
    `, [userId, futureDateString], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const tasks = rows.map(row => ({
          ...row,
          completed: Boolean(row.completed)
        }));
        resolve(tasks);
      }
    });
  });
};

// Add this new method to check and update plan completion status
Task.checkAndUpdatePlanCompletion = async function(taskId) {
  return new Promise((resolve, reject) => {
    const database = require('../database');
    const db = database.getDB();
    
    // First, get the task to see if it belongs to a plan
    db.get(`
      SELECT t.plan_id, p.completed as plan_completed
      FROM tasks t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = ?
    `, [taskId], async (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      // If task doesn't belong to a plan, nothing to do
      if (!row || !row.plan_id) {
        resolve(null);
        return;
      }
      
      // If plan is already completed, nothing to do
      if (row.plan_completed) {
        resolve(null);
        return;
      }
      
      // Check if all tasks in the plan are completed
      try {
        const Plan = require('./Plan');
        const updatedPlan = await Plan.markPlanAsCompletedIfAllTasksDone(row.plan_id);
        resolve(updatedPlan);
      } catch (planErr) {
        reject(planErr);
      }
    });
  });
};

module.exports = Task;