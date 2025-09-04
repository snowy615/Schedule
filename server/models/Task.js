const database = require('../database');

class Task {
  // Create a new task
  static async create(userId, taskData) {
    return new Promise((resolve, reject) => {
      const { title, description, date, time } = taskData;
      const db = database.getDB();
      const stmt = db.prepare(`
        INSERT INTO tasks (user_id, title, description, date, time) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([userId, title, description || null, date, time || null], function(err) {
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
        ORDER BY date ASC, time ASC, created_at ASC
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
      const allowedFields = ['title', 'description', 'date', 'time', 'completed'];
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
          Task.findById(id).then(resolve).catch(reject);
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
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.run(`
        UPDATE tasks 
        SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND user_id = ?
      `, [id, userId], function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('Task not found or unauthorized'));
        } else {
          Task.findById(id).then(resolve).catch(reject);
        }
      });
    });
  }
}

module.exports = Task;