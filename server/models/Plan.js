const database = require('../database');

class Plan {
  // Create a new plan with tasks
  static async create(userId, planData) {
    return new Promise((resolve, reject) => {
      const { title, description, date, tasks } = planData;
      const db = database.getDB();
      
      // Start transaction
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Create the plan
        const planStmt = db.prepare(`
          INSERT INTO plans (user_id, title, description, date) 
          VALUES (?, ?, ?, ?)
        `);
        
        planStmt.run([userId, title, description || null, date], function(err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          const planId = this.lastID;
          
          // Create tasks for the plan
          if (tasks && tasks.length > 0) {
            const taskStmt = db.prepare(`
              INSERT INTO tasks (user_id, title, description, date, plan_id, plan_order, priority) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            let tasksCreated = 0;
            let hasError = false;
            
            tasks.forEach((task, index) => {
              taskStmt.run([
                userId, 
                task.title, 
                task.description || null, 
                task.date || date, // Use task's date if provided, otherwise plan date
                planId, 
                index,
                task.priority || 3
              ], function(taskErr) {
                if (taskErr && !hasError) {
                  hasError = true;
                  db.run('ROLLBACK');
                  taskStmt.finalize();
                  planStmt.finalize();
                  reject(taskErr);
                  return;
                }
                
                tasksCreated++;
                if (tasksCreated === tasks.length && !hasError) {
                  // All tasks created successfully
                  db.run('COMMIT', (commitErr) => {
                    taskStmt.finalize();
                    planStmt.finalize();
                    
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      // Return the created plan with tasks
                      Plan.findById(planId).then(resolve).catch(reject);
                    }
                  });
                }
              });
            });
          } else {
            // No tasks, just commit the plan
            db.run('COMMIT', (commitErr) => {
              planStmt.finalize();
              
              if (commitErr) {
                reject(commitErr);
              } else {
                Plan.findById(planId).then(resolve).catch(reject);
              }
            });
          }
        });
      });
    });
  }

  // Find plan by ID with its tasks
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Get the plan
      db.get('SELECT * FROM plans WHERE id = ?', [id], (err, planRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!planRow) {
          resolve(null);
          return;
        }
        
        // Get the plan's tasks
        db.all(`
          SELECT * FROM tasks 
          WHERE plan_id = ? 
          ORDER BY plan_order ASC
        `, [id], (taskErr, taskRows) => {
          if (taskErr) {
            reject(taskErr);
            return;
          }
          
          const plan = {
            ...planRow,
            completed: Boolean(planRow.completed),
            tasks: taskRows.map(task => ({
              ...task,
              completed: Boolean(task.completed)
            }))
          };
          
          resolve(plan);
        });
      });
    });
  }

  // Get all plans for a user with their tasks
  static async findByUserId(userId) {
    return new Promise(async (resolve, reject) => {
      const db = database.getDB();
      
      try {
        // Get all plans for the user
        db.all(`
          SELECT * FROM plans 
          WHERE user_id = ? 
          ORDER BY date ASC, created_at ASC
        `, [userId], async (err, planRows) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (planRows.length === 0) {
            resolve([]);
            return;
          }
          
          // Get tasks for all plans in one query
          const planIds = planRows.map(plan => plan.id);
          const placeholders = planIds.map(() => '?').join(',');
          
          db.all(`
            SELECT * FROM tasks 
            WHERE plan_id IN (${placeholders})
            ORDER BY plan_id ASC, plan_order ASC
          `, planIds, (taskErr, taskRows) => {
            if (taskErr) {
              reject(taskErr);
              return;
            }
            
            // Group tasks by plan_id
            const tasksByPlanId = {};
            taskRows.forEach(task => {
              if (!tasksByPlanId[task.plan_id]) {
                tasksByPlanId[task.plan_id] = [];
              }
              tasksByPlanId[task.plan_id].push({
                ...task,
                completed: Boolean(task.completed)
              });
            });
            
            // Combine plans with their tasks
            const plansWithTasks = planRows.map(plan => ({
              ...plan,
              completed: Boolean(plan.completed),
              tasks: tasksByPlanId[plan.id] || []
            }));
            
            resolve(plansWithTasks);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get plans for a specific date with their tasks
  static async findByUserAndDate(userId, date) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Get plans for the specific date
      db.all(`
        SELECT * FROM plans 
        WHERE user_id = ? AND date = ? 
        ORDER BY created_at ASC
      `, [userId, date], (err, planRows) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (planRows.length === 0) {
          resolve([]);
          return;
        }
        
        // Get tasks for all plans in one query
        const planIds = planRows.map(plan => plan.id);
        const placeholders = planIds.map(() => '?').join(',');
        
        db.all(`
          SELECT * FROM tasks 
          WHERE plan_id IN (${placeholders})
          ORDER BY plan_id ASC, plan_order ASC
        `, planIds, (taskErr, taskRows) => {
          if (taskErr) {
            reject(taskErr);
            return;
          }
          
          // Group tasks by plan_id
          const tasksByPlanId = {};
          taskRows.forEach(task => {
            if (!tasksByPlanId[task.plan_id]) {
              tasksByPlanId[task.plan_id] = [];
            }
            tasksByPlanId[task.plan_id].push({
              ...task,
              completed: Boolean(task.completed)
            });
          });
          
          // Combine plans with their tasks
          const plansWithTasks = planRows.map(plan => ({
            ...plan,
            completed: Boolean(plan.completed),
            tasks: tasksByPlanId[plan.id] || []
          }));
          
          resolve(plansWithTasks);
        });
      });
    });
  }

  // Get current active task for a plan
  static async getCurrentTask(planId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // First get the plan to check current_task_index
      db.get('SELECT * FROM plans WHERE id = ?', [planId], (err, plan) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!plan) {
          resolve(null);
          return;
        }
        
        // Get the current task based on current_task_index
        db.get(`
          SELECT * FROM tasks 
          WHERE plan_id = ? AND plan_order = ?
        `, [planId, plan.current_task_index], (taskErr, task) => {
          if (taskErr) {
            reject(taskErr);
          } else {
            resolve(task ? { ...task, completed: Boolean(task.completed) } : null);
          }
        });
      });
    });
  }

  // Complete current task and move to next
  static async completeCurrentTask(planId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Get the plan and current task
        db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, userId], (err, plan) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          if (!plan) {
            db.run('ROLLBACK');
            reject(new Error('Plan not found or unauthorized'));
            return;
          }
          
          // Get the current task
          db.get(`
            SELECT * FROM tasks 
            WHERE plan_id = ? AND plan_order = ?
          `, [planId, plan.current_task_index], (taskErr, task) => {
            if (taskErr) {
              db.run('ROLLBACK');
              reject(taskErr);
              return;
            }
            
            if (!task) {
              db.run('ROLLBACK');
              reject(new Error('Current task not found'));
              return;
            }
            
            // Mark current task as completed
            db.run(`
              UPDATE tasks 
              SET completed = 1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `, [task.id], (updateErr) => {
              if (updateErr) {
                db.run('ROLLBACK');
                reject(updateErr);
                return;
              }
              
              // Check if there are more tasks
              db.get(`
                SELECT COUNT(*) as total_tasks FROM tasks 
                WHERE plan_id = ?
              `, [planId], (countErr, countResult) => {
                if (countErr) {
                  db.run('ROLLBACK');
                  reject(countErr);
                  return;
                }
                
                const nextTaskIndex = plan.current_task_index + 1;
                const isLastTask = nextTaskIndex >= countResult.total_tasks;
                
                // Update plan
                db.run(`
                  UPDATE plans 
                  SET current_task_index = ?, completed = ?, updated_at = CURRENT_TIMESTAMP 
                  WHERE id = ?
                `, [nextTaskIndex, isLastTask ? 1 : 0, planId], (planUpdateErr) => {
                  if (planUpdateErr) {
                    db.run('ROLLBACK');
                    reject(planUpdateErr);
                    return;
                  }
                  
                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      reject(commitErr);
                    } else {
                      Plan.findById(planId).then(resolve).catch(reject);
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // Delete a plan and all its tasks
  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Delete all tasks for this plan
        db.run('DELETE FROM tasks WHERE plan_id = ? AND user_id = ?', [id, userId], (taskErr) => {
          if (taskErr) {
            db.run('ROLLBACK');
            reject(taskErr);
            return;
          }
          
          // Delete the plan
          db.run('DELETE FROM plans WHERE id = ? AND user_id = ?', [id, userId], function(planErr) {
            if (planErr) {
              db.run('ROLLBACK');
              reject(planErr);
              return;
            }
            
            if (this.changes === 0) {
              db.run('ROLLBACK');
              reject(new Error('Plan not found or unauthorized'));
              return;
            }
            
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                reject(commitErr);
              } else {
                resolve({ message: 'Plan deleted successfully' });
              }
            });
          });
        });
      });
    });
  }

  // Add a task to an existing plan
  static async addTask(planId, userId, taskData) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and belongs to user
        db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, userId], (err, plan) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          if (!plan) {
            db.run('ROLLBACK');
            reject(new Error('Plan not found or unauthorized'));
            return;
          }
          
          // Get the next plan_order
          db.get('SELECT MAX(plan_order) as max_order FROM tasks WHERE plan_id = ?', [planId], (orderErr, orderResult) => {
            if (orderErr) {
              db.run('ROLLBACK');
              reject(orderErr);
              return;
            }
            
            const nextOrder = (orderResult.max_order || -1) + 1;
            
            // Insert the new task
            db.run(`
              INSERT INTO tasks (user_id, title, description, date, plan_id, plan_order, priority) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, taskData.title, taskData.description, taskData.date || plan.date, planId, nextOrder, taskData.priority], function(taskErr) {
              if (taskErr) {
                db.run('ROLLBACK');
                reject(taskErr);
                return;
              }
              
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(commitErr);
                } else {
                  Plan.findById(planId).then(resolve).catch(reject);
                }
              });
            });
          });
        });
      });
    });
  }

  // Update a task in a plan
  static async updateTask(planId, taskId, userId, updates) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and belongs to user
        db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, userId], (err, plan) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          if (!plan) {
            db.run('ROLLBACK');
            reject(new Error('Plan not found or unauthorized'));
            return;
          }
          
          // Verify task belongs to the plan
          db.get('SELECT * FROM tasks WHERE id = ? AND plan_id = ? AND user_id = ?', [taskId, planId, userId], (taskErr, task) => {
            if (taskErr) {
              db.run('ROLLBACK');
              reject(taskErr);
              return;
            }
            
            if (!task) {
              db.run('ROLLBACK');
              reject(new Error('Task not found or does not belong to plan'));
              return;
            }
            
            // Build dynamic update query
            const allowedFields = ['title', 'description', 'priority', 'date'];
            const fields = [];
            const values = [];
            
            for (const [key, value] of Object.entries(updates)) {
              if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
              }
            }
            
            if (fields.length === 0) {
              db.run('ROLLBACK');
              reject(new Error('No valid fields to update'));
              return;
            }
            
            // Add updated_at timestamp
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(taskId);
            
            const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
            
            db.run(query, values, function(updateErr) {
              if (updateErr) {
                db.run('ROLLBACK');
                reject(updateErr);
                return;
              }
              
              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  reject(commitErr);
                } else {
                  Plan.findById(planId).then(resolve).catch(reject);
                }
              });
            });
          });
        });
      });
    });
  }

  // Delete a task from a plan
  static async deleteTask(planId, taskId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and belongs to user
        db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, userId], (err, plan) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          if (!plan) {
            db.run('ROLLBACK');
            reject(new Error('Plan not found or unauthorized'));
            return;
          }
          
          // Check if plan has more than one task (can't delete the last task)
          db.get('SELECT COUNT(*) as task_count FROM tasks WHERE plan_id = ?', [planId], (countErr, countResult) => {
            if (countErr) {
              db.run('ROLLBACK');
              reject(countErr);
              return;
            }
            
            if (countResult.task_count <= 1) {
              db.run('ROLLBACK');
              reject(new Error('Cannot delete task: plan must have at least one task'));
              return;
            }
            
            // Verify task belongs to the plan
            db.get('SELECT plan_order FROM tasks WHERE id = ? AND plan_id = ? AND user_id = ?', [taskId, planId, userId], (taskErr, task) => {
              if (taskErr) {
                db.run('ROLLBACK');
                reject(taskErr);
                return;
              }
              
              if (!task) {
                db.run('ROLLBACK');
                reject(new Error('Task not found or does not belong to plan'));
                return;
              }
              
              const deletedOrder = task.plan_order;
              
              // Delete the task
              db.run('DELETE FROM tasks WHERE id = ?', [taskId], function(deleteErr) {
                if (deleteErr) {
                  db.run('ROLLBACK');
                  reject(deleteErr);
                  return;
                }
                
                // Reorder remaining tasks
                db.run(`
                  UPDATE tasks 
                  SET plan_order = plan_order - 1, updated_at = CURRENT_TIMESTAMP 
                  WHERE plan_id = ? AND plan_order > ?
                `, [planId, deletedOrder], (reorderErr) => {
                  if (reorderErr) {
                    db.run('ROLLBACK');
                    reject(reorderErr);
                    return;
                  }
                  
                  // Update plan's current_task_index if necessary
                  let newCurrentIndex = plan.current_task_index;
                  if (deletedOrder < plan.current_task_index) {
                    newCurrentIndex = Math.max(0, plan.current_task_index - 1);
                  } else if (deletedOrder === plan.current_task_index) {
                    // If we deleted the current task, keep the same index (next task becomes current)
                    newCurrentIndex = plan.current_task_index;
                  }
                  
                  db.run(`
                    UPDATE plans 
                    SET current_task_index = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                  `, [newCurrentIndex, planId], (planUpdateErr) => {
                    if (planUpdateErr) {
                      db.run('ROLLBACK');
                      reject(planUpdateErr);
                      return;
                    }
                    
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        reject(commitErr);
                      } else {
                        Plan.findById(planId).then(resolve).catch(reject);
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }
}

module.exports = Plan;