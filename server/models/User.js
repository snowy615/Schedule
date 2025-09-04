const bcrypt = require('bcrypt');
const database = require('../database');

class User {
  // Create a new user
  static async create(email, password, name) {
    return new Promise(async (resolve, reject) => {
      try {
        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const db = database.getDB();
        const stmt = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
        
        stmt.run([email, hashedPassword, name], function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              reject(new Error('User with this email already exists'));
            } else {
              reject(err);
            }
          } else {
            resolve({
              id: this.lastID,
              email,
              name
            });
          }
        });
        stmt.finalize();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Find user by email
  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Find user by ID
  static async findById(id) {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Get all users (for admin purposes)
  static async getAll() {
    return new Promise((resolve, reject) => {
      const db = database.getDB();
      db.all('SELECT id, email, name, created_at FROM users', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = User;