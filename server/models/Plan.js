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

  // Get all plans for a user with their tasks (including shared plans)
  static async findByUserId(userId) {
    return new Promise(async (resolve, reject) => {
      const db = database.getDB();
      
      try {
        // Get all plans for the user (owned + shared)
        db.all(`
          SELECT p.*, sp.permissions as shared_permissions, sp.shared_with_user_id
          FROM plans p
          LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
          WHERE p.user_id = ? OR sp.shared_with_user_id = ?
          ORDER BY p.date ASC, p.created_at ASC
        `, [userId, userId, userId], async (err, planRows) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (planRows.length === 0) {
            resolve([]);
            return;
          }
          
          // Get completion status for all plans
          const planIds = planRows.map(plan => plan.id);
          const placeholders = planIds.map(() => '?').join(',');
          
          // Get plan completion status
          db.all(`
            SELECT plan_id, user_id, completed FROM plan_completion_status
            WHERE plan_id IN (${placeholders}) AND user_id = ?
          `, [...planIds, userId], async (completionErr, completionRows) => {
            if (completionErr) {
              reject(completionErr);
              return;
            }
            
            // Create a map of plan completion status
            const completionMap = {};
            completionRows.forEach(row => {
              completionMap[row.plan_id] = row.completed;
            });
            
            // Get tasks for all plans in one query
            db.all(`
              SELECT * FROM tasks 
              WHERE plan_id IN (${placeholders})
              ORDER BY plan_id ASC, plan_order ASC
            `, planIds, async (taskErr, taskRows) => {
              if (taskErr) {
                reject(taskErr);
                return;
              }
              
              // For plans with individual permission, get individual task statuses
              const individualTaskStatuses = {};
              for (const plan of planRows) {
                if (plan.shared_with_user_id !== null && plan.shared_with_user_id == userId && plan.shared_permissions === 'individual') {
                  const statuses = await Plan.getIndividualTaskStatusesForPlan(plan.id, userId);
                  individualTaskStatuses[plan.id] = statuses.reduce((acc, status) => {
                    acc[status.task_id] = status;
                    return acc;
                  }, {});
                }
              }
              
              // Group tasks by plan_id
              const tasksByPlanId = {};
              taskRows.forEach(task => {
                if (!tasksByPlanId[task.plan_id]) {
                  tasksByPlanId[task.plan_id] = [];
                }
                
                // For individual plans, override task completion status with individual status
                let taskWithStatus = {
                  ...task,
                  completed: Boolean(task.completed)
                };
                
                if (individualTaskStatuses[task.plan_id] && individualTaskStatuses[task.plan_id][task.id]) {
                  taskWithStatus.completed = individualTaskStatuses[task.plan_id][task.id].completed;
                  taskWithStatus.individual_status = individualTaskStatuses[task.plan_id][task.id];
                }
                
                tasksByPlanId[task.plan_id].push(taskWithStatus);
              });
              
              // Combine plans with their tasks and completion status
              const plansWithTasks = planRows.map(plan => {
                // Determine if plan is completed based on user's completion status
                let isCompleted = false;
                if (completionMap.hasOwnProperty(plan.id)) {
                  // Use user-specific completion status
                  isCompleted = Boolean(completionMap[plan.id]);
                } else {
                  // Fallback to original plan completion status for backward compatibility
                  isCompleted = Boolean(plan.completed);
                }
                
                return {
                  ...plan,
                  completed: isCompleted,
                  tasks: tasksByPlanId[plan.id] || [],
                  is_shared: plan.shared_with_user_id !== null && plan.shared_with_user_id == userId, // Mark if this is a shared plan for this user
                  shared_permissions: plan.shared_permissions || null
                };
              });
              
              resolve(plansWithTasks);
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get plans for a specific date with their tasks (including shared plans)
  static async findByUserAndDate(userId, date) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Get plans for the specific date (owned + shared)
      db.all(`
        SELECT p.*, sp.permissions as shared_permissions, sp.shared_with_user_id
        FROM plans p
        LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
        WHERE (p.user_id = ? OR sp.shared_with_user_id = ?) AND p.date = ?
        ORDER BY p.created_at ASC
      `, [userId, userId, userId, date], async (err, planRows) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (planRows.length === 0) {
          resolve([]);
          return;
        }
        
        // Get completion status for all plans
        const planIds = planRows.map(plan => plan.id);
        const placeholders = planIds.map(() => '?').join(',');
        
        // Get plan completion status
        db.all(`
          SELECT plan_id, user_id, completed FROM plan_completion_status
          WHERE plan_id IN (${placeholders}) AND user_id = ?
        `, [...planIds, userId], async (completionErr, completionRows) => {
          if (completionErr) {
            reject(completionErr);
            return;
          }
          
          // Create a map of plan completion status
          const completionMap = {};
          completionRows.forEach(row => {
            completionMap[row.plan_id] = row.completed;
          });
          
          // Get tasks for all plans in one query
          db.all(`
            SELECT * FROM tasks 
            WHERE plan_id IN (${placeholders})
            ORDER BY plan_id ASC, plan_order ASC
          `, planIds, async (taskErr, taskRows) => {
            if (taskErr) {
              reject(taskErr);
              return;
            }
            
            // For plans with individual permission, get individual task statuses
            const individualTaskStatuses = {};
            for (const plan of planRows) {
              if (plan.shared_with_user_id !== null && plan.shared_with_user_id == userId && plan.shared_permissions === 'individual') {
                const statuses = await Plan.getIndividualTaskStatusesForPlan(plan.id, userId);
                individualTaskStatuses[plan.id] = statuses.reduce((acc, status) => {
                  acc[status.task_id] = status;
                  return acc;
                }, {});
              }
            }
            
            // Group tasks by plan_id
            const tasksByPlanId = {};
            taskRows.forEach(task => {
              if (!tasksByPlanId[task.plan_id]) {
                tasksByPlanId[task.plan_id] = [];
              }
              
              // For individual plans, override task completion status with individual status
              let taskWithStatus = {
                ...task,
                completed: Boolean(task.completed)
              };
              
              if (individualTaskStatuses[task.plan_id] && individualTaskStatuses[task.plan_id][task.id]) {
                taskWithStatus.completed = individualTaskStatuses[task.plan_id][task.id].completed;
                taskWithStatus.individual_status = individualTaskStatuses[task.plan_id][task.id];
              }
              
              tasksByPlanId[task.plan_id].push(taskWithStatus);
            });
            
            // Combine plans with their tasks and completion status
            const plansWithTasks = planRows.map(plan => {
              // Determine if plan is completed based on user's completion status
              let isCompleted = false;
              if (completionMap.hasOwnProperty(plan.id)) {
                // Use user-specific completion status
                isCompleted = Boolean(completionMap[plan.id]);
              } else {
                // Fallback to original plan completion status for backward compatibility
                isCompleted = Boolean(plan.completed);
              }
              
              return {
                ...plan,
                completed: isCompleted,
                tasks: tasksByPlanId[plan.id] || [],
                is_shared: plan.shared_with_user_id !== null && plan.shared_with_user_id == userId, // Mark if this is a shared plan for this user
                shared_permissions: plan.shared_permissions || null
              };
            });
            
            resolve(plansWithTasks);
          });
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

  // Complete current task and move to next (for plan owners and users with write permissions)
  static async completeCurrentTask(planId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Get the plan and check if user has permission to modify it
        db.get(`
          SELECT p.*, sp.permissions as shared_permissions
          FROM plans p
          LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
          WHERE p.id = ? AND (p.user_id = ? OR sp.shared_with_user_id = ?)
        `, [userId, planId, userId, userId], (err, plan) => {
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
          
          // Check permissions - only owner or users with write permissions can modify
          // For individual permission, users can only update their own task status
          if (plan.user_id !== userId && plan.shared_permissions !== 'write' && plan.shared_permissions !== 'individual') {
            db.run('ROLLBACK');
            reject(new Error('Insufficient permissions to modify this plan'));
            return;
          }
          
          // If user has individual permission, we need to handle task completion differently
          if (plan.shared_permissions === 'individual') {
            // For individual permission, we'll need to get the current task and set individual status
            // Get the current task based on current_task_index
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
              
              // Set individual task status instead of updating the main task
              Plan.setIndividualTaskStatus(task.id, userId, true)
                .then(() => {
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
                    const totalTasks = countResult.total_tasks;
                    const isLastTask = nextTaskIndex >= totalTasks;
                    
                    // If this was the last task, mark plan as completed for this user
                    // Otherwise, move to next task
                    const newTaskIndex = isLastTask ? totalTasks : nextTaskIndex;
                    
                    // Update plan completion status for this user
                    const completedAt = isLastTask ? new Date().toISOString() : null;
                    db.run(`
                      INSERT OR REPLACE INTO plan_completion_status 
                      (plan_id, user_id, completed, completed_at, updated_at) 
                      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `, [planId, userId, isLastTask ? 1 : 0, completedAt], (completionErr) => {
                      if (completionErr) {
                        db.run('ROLLBACK');
                        reject(completionErr);
                        return;
                      }
                      
                      // Update plan's current_task_index
                      db.run(`
                        UPDATE plans 
                        SET current_task_index = ?, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                      `, [newTaskIndex, planId], (planUpdateErr) => {
                        if (planUpdateErr) {
                          db.run('ROLLBACK');
                          reject(planUpdateErr);
                          return;
                        }
                        
                        db.run('COMMIT', (commitErr) => {
                          if (commitErr) {
                            reject(commitErr);
                          } else {
                            // Re-fetch the plan with updated individual task statuses
                            Plan.findByUserId(userId).then(plans => {
                              const updatedPlan = plans.find(p => p.id == planId);
                              resolve(updatedPlan);
                            }).catch(reject);
                          }
                        });
                      });
                    });
                  });
                })
                .catch(setStatusErr => {
                  db.run('ROLLBACK');
                  reject(setStatusErr);
                });
            });
          } else {
            // Standard completion logic for owner/write permissions
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
                  const totalTasks = countResult.total_tasks;
                  const isLastTask = nextTaskIndex >= totalTasks;
                  
                  // If this was the last task, mark plan as completed
                  // Otherwise, move to next task
                  const newTaskIndex = isLastTask ? totalTasks : nextTaskIndex;
                  const planCompleted = isLastTask ? 1 : 0;
                  
                  // Update plan completion status for the owner
                  const completedAt = isLastTask ? new Date().toISOString() : null;
                  db.run(`
                    INSERT OR REPLACE INTO plan_completion_status 
                    (plan_id, user_id, completed, completed_at, updated_at) 
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                  `, [planId, plan.user_id, planCompleted, completedAt], (completionErr) => {
                    if (completionErr) {
                      db.run('ROLLBACK');
                      reject(completionErr);
                      return;
                    }
                    
                    // Update plan
                    db.run(`
                      UPDATE plans 
                      SET current_task_index = ?, completed = ?, updated_at = CURRENT_TIMESTAMP 
                      WHERE id = ?
                    `, [newTaskIndex, planCompleted, planId], (planUpdateErr) => {
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
          }
        });
      });
    });
  }

  // Delete a plan (only for plan owners)
  static async delete(id, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and belongs to user (only owner can delete)
        db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [id, userId], (err, plan) => {
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
    });
  }

  // Add a task to an existing plan (for plan owners and users with write permissions)
  static async addTask(planId, userId, taskData) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and user has permission to modify it
        db.get(`
          SELECT p.*, sp.permissions as shared_permissions
          FROM plans p
          LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
          WHERE p.id = ? AND (p.user_id = ? OR sp.shared_with_user_id = ?)
        `, [userId, planId, userId, userId], (err, plan) => {
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
          
          // Check permissions - only owner or users with write permissions can modify
          if (plan.user_id !== userId && plan.shared_permissions !== 'write') {
            db.run('ROLLBACK');
            reject(new Error('Insufficient permissions to modify this plan'));
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

  // Update a task in a plan (for plan owners and users with write permissions)
  static async updateTask(planId, taskId, userId, updates) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and user has permission to modify it
        db.get(`
          SELECT p.*, sp.permissions as shared_permissions
          FROM plans p
          LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
          WHERE p.id = ? AND (p.user_id = ? OR sp.shared_with_user_id = ?)
        `, [userId, planId, userId, userId], (err, plan) => {
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
          
          // Check permissions - only owner or users with write permissions can modify
          if (plan.user_id !== userId && plan.shared_permissions !== 'write') {
            db.run('ROLLBACK');
            reject(new Error('Insufficient permissions to modify this plan'));
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
            
            // Check if we're updating the completed status
            const isCompletionUpdate = updates.hasOwnProperty('completed') && updates.completed !== task.completed;
            
            // Build dynamic update query
            const allowedFields = ['title', 'description', 'priority', 'date', 'completed'];
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
              
              // If this was a completion update, check if all tasks are now completed
              if (isCompletionUpdate) {
                Plan.markPlanAsCompletedIfAllTasksDone(planId)
                  .then(() => {
                    db.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        reject(commitErr);
                      } else {
                        Plan.findById(planId).then(resolve).catch(reject);
                      }
                    });
                  })
                  .catch(markErr => {
                    db.run('ROLLBACK');
                    reject(markErr);
                  });
              } else {
                db.run('COMMIT', (commitErr) => {
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
      });
    });
  }

  // Delete a task from a plan (for plan owners and users with write permissions)
  static async deleteTask(planId, taskId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Verify plan exists and user has permission to modify it
        db.get(`
          SELECT p.*, sp.permissions as shared_permissions
          FROM plans p
          LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
          WHERE p.id = ? AND (p.user_id = ? OR sp.shared_with_user_id = ?)
        `, [userId, planId, userId, userId], (err, plan) => {
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
          
          // Check permissions - only owner or users with write permissions can modify
          if (plan.user_id !== userId && plan.shared_permissions !== 'write') {
            db.run('ROLLBACK');
            reject(new Error('Insufficient permissions to modify this plan'));
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

  // Share a plan with another user
  static async sharePlan(planId, ownerId, sharedWithUserId, permissions = 'read') {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Verify plan exists and belongs to owner
      db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, ownerId], (err, plan) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!plan) {
          reject(new Error('Plan not found or unauthorized'));
          return;
        }
        
        // Check if trying to share with self
        if (ownerId === sharedWithUserId) {
          reject(new Error('Cannot share plan with yourself'));
          return;
        }
        
        // Insert or update shared plan record
        db.run(`
          INSERT OR REPLACE INTO shared_plans 
          (plan_id, owner_id, shared_with_user_id, permissions) 
          VALUES (?, ?, ?, ?)
        `, [planId, ownerId, sharedWithUserId, permissions], function(insertErr) {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve({
              message: 'Plan shared successfully',
              shared_plan: {
                id: this.lastID,
                plan_id: planId,
                owner_id: ownerId,
                shared_with_user_id: sharedWithUserId,
                permissions
              }
            });
          }
        });
      });
    });
  }

  // Unshare a plan with a user
  static async unsharePlan(planId, ownerId, sharedWithUserId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Verify plan exists and belongs to owner
      db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, ownerId], (err, plan) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!plan) {
          reject(new Error('Plan not found or unauthorized'));
          return;
        }
        
        // Delete shared plan record
        db.run(`
          DELETE FROM shared_plans 
          WHERE plan_id = ? AND owner_id = ? AND shared_with_user_id = ?
        `, [planId, ownerId, sharedWithUserId], function(deleteErr) {
          if (deleteErr) {
            reject(deleteErr);
          } else {
            resolve({
              message: 'Plan unshared successfully',
              changes: this.changes
            });
          }
        });
      });
    });
  }

  // Get users a plan is shared with
  static async getSharedUsers(planId, ownerId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Verify plan exists and belongs to owner
      db.get('SELECT * FROM plans WHERE id = ? AND user_id = ?', [planId, ownerId], (err, plan) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!plan) {
          reject(new Error('Plan not found or unauthorized'));
          return;
        }
        
        // Get shared users
        db.all(`
          SELECT u.id, u.email, u.name, sp.permissions, sp.created_at
          FROM shared_plans sp
          JOIN users u ON sp.shared_with_user_id = u.id
          WHERE sp.plan_id = ?
        `, [planId], (sharedErr, sharedUsers) => {
          if (sharedErr) {
            reject(sharedErr);
          } else {
            resolve(sharedUsers);
          }
        });
      });
    });
  }

  // Helper function to check if all tasks in a plan are completed
  static async areAllTasksCompleted(planId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.get(`
        SELECT COUNT(*) as total_tasks, 
               SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks
        FROM tasks 
        WHERE plan_id = ?
      `, [planId], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.total_tasks > 0 && result.total_tasks === result.completed_tasks);
        }
      });
    });
  }

  // Helper function to mark plan as completed if all tasks are completed
  static async markPlanAsCompletedIfAllTasksDone(planId) {
    return new Promise(async (resolve, reject) => {
      try {
        const allTasksCompleted = await Plan.areAllTasksCompleted(planId);
        
        if (allTasksCompleted) {
          const db = database.getDB();
          
          // Get the total number of tasks to set current_task_index correctly
          db.get('SELECT COUNT(*) as total_tasks FROM tasks WHERE plan_id = ?', [planId], (err, result) => {
            if (err) {
              reject(err);
              return;
            }
            
            const totalTasks = result.total_tasks;
            
            // Mark plan as completed
            db.run(`
              UPDATE plans 
              SET completed = 1, current_task_index = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `, [totalTasks, planId], (updateErr) => {
              if (updateErr) {
                reject(updateErr);
              } else {
                Plan.findById(planId).then(resolve).catch(reject);
              }
            });
          });
        } else {
          // If not all tasks are completed, resolve with null to indicate no change was needed
          resolve(null);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Set individual task completion status for a user
  static async setIndividualTaskStatus(taskId, userId, completed) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      const completedAt = completed ? new Date().toISOString() : null;
      
      db.run(`
        INSERT OR REPLACE INTO individual_task_status 
        (task_id, user_id, completed, completed_at, updated_at) 
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [taskId, userId, completed ? 1 : 0, completedAt], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            task_id: taskId,
            user_id: userId,
            completed: completed,
            completed_at: completedAt
          });
        }
      });
    });
  }

  // Get individual task status for a user
  static async getIndividualTaskStatus(taskId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.get(`
        SELECT * FROM individual_task_status 
        WHERE task_id = ? AND user_id = ?
      `, [taskId, userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? {
            ...row,
            completed: Boolean(row.completed)
          } : null);
        }
      });
    });
  }

  // Get all individual task statuses for a user in a plan
  static async getIndividualTaskStatusesForPlan(planId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      db.all(`
        SELECT its.* FROM individual_task_status its
        JOIN tasks t ON its.task_id = t.id
        WHERE t.plan_id = ? AND its.user_id = ?
      `, [planId, userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            completed: Boolean(row.completed)
          })));
        }
      });
    });
  }

  // Check if a plan is completed for a specific user based on permission type
  static async isPlanCompletedForUser(planId, userId) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      
      // Get plan and user permission
      db.get(`
        SELECT p.*, sp.permissions as shared_permissions
        FROM plans p
        LEFT JOIN shared_plans sp ON p.id = sp.plan_id AND sp.shared_with_user_id = ?
        WHERE p.id = ? AND (p.user_id = ? OR sp.shared_with_user_id = ?)
      `, [userId, planId, userId, userId], (err, plan) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!plan) {
          resolve(false);
          return;
        }
        
        // For individual permission, check if all tasks are completed by this user
        if (plan.shared_permissions === 'individual') {
          // Get all tasks for this plan
          db.all(`
            SELECT t.id FROM tasks t WHERE t.plan_id = ?
          `, [planId], (taskErr, tasks) => {
            if (taskErr) {
              reject(taskErr);
              return;
            }
            
            if (tasks.length === 0) {
              resolve(true);
              return;
            }
            
            // Get individual task statuses for this user
            const taskIds = tasks.map(task => task.id);
            const placeholders = taskIds.map(() => '?').join(',');
            
            db.all(`
              SELECT task_id, completed FROM individual_task_status
              WHERE task_id IN (${placeholders}) AND user_id = ?
            `, [...taskIds, userId], (statusErr, statuses) => {
              if (statusErr) {
                reject(statusErr);
                return;
              }
              
              // Check if all tasks are completed by this user
              const statusMap = {};
              statuses.forEach(status => {
                statusMap[status.task_id] = status.completed;
              });
              
              // Check if all tasks are completed
              const allCompleted = tasks.every(task => 
                statusMap.hasOwnProperty(task.id) && statusMap[task.id]
              );
              
              resolve(allCompleted);
            });
          });
        } else {
          // For owner/write permissions, check plan completion status
          db.get(`
            SELECT completed FROM plan_completion_status
            WHERE plan_id = ? AND user_id = ?
          `, [planId, userId], (completionErr, completionRow) => {
            if (completionErr) {
              reject(completionErr);
              return;
            }
            
            // If we have a specific completion status for this user, use it
            if (completionRow) {
              resolve(Boolean(completionRow.completed));
            } else {
              // Otherwise, fallback to original plan completion status
              resolve(Boolean(plan.completed));
            }
          });
        }
      });
    });
  }

}

module.exports = Plan;