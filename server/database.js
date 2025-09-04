const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection and create tables
  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '../schedule.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Create necessary tables
  async createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
            return;
          }
        });

        // Create tasks table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            start_time TEXT,
            finish_time TEXT,
            priority INTEGER DEFAULT 3,
            completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating tasks table:', err);
            reject(err);
            return;
          }
          
          // Migrate existing data from 'time' column to 'start_time'
          this.migrateTimeColumn().then(() => {
            // Add priority column to existing tables if needed
            return this.addPriorityColumn();
          }).then(() => {
            console.log('Database tables created successfully');
            resolve();
          }).catch(reject);
        });
      });
    });
  }

  // Migrate existing 'time' column data to 'start_time' and 'finish_time'
  async migrateTimeColumn() {
    return new Promise((resolve, reject) => {
      // Check if 'time' column exists
      this.db.get("PRAGMA table_info(tasks)", (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Check if migration is needed
        this.db.all("PRAGMA table_info(tasks)", (err, columns) => {
          if (err) {
            reject(err);
            return;
          }
          
          const hasTimeColumn = columns.some(col => col.name === 'time');
          const hasStartTimeColumn = columns.some(col => col.name === 'start_time');
          
          if (hasTimeColumn && !hasStartTimeColumn) {
            // Need to migrate
            this.db.serialize(() => {
              // Add new columns
              this.db.run("ALTER TABLE tasks ADD COLUMN start_time TEXT", (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                  console.error('Error adding start_time column:', err);
                }
              });
              
              this.db.run("ALTER TABLE tasks ADD COLUMN finish_time TEXT", (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                  console.error('Error adding finish_time column:', err);
                }
              });
              
              // Copy data from time to start_time
              this.db.run("UPDATE tasks SET start_time = time WHERE time IS NOT NULL", (err) => {
                if (err) {
                  console.error('Error migrating time data:', err);
                }
                resolve();
              });
            });
          } else {
            resolve();
          }
        });
      });
    });
  }

  // Add priority column to existing tasks table if needed
  async addPriorityColumn() {
    return new Promise((resolve, reject) => {
      // Check if priority column exists
      this.db.all("PRAGMA table_info(tasks)", (err, columns) => {
        if (err) {
          reject(err);
          return;
        }
        
        const hasPriorityColumn = columns.some(col => col.name === 'priority');
        
        if (!hasPriorityColumn) {
          // Add priority column with default value 3 (medium priority)
          this.db.run("ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 3", (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.error('Error adding priority column:', err);
              reject(err);
            } else {
              console.log('Priority column added successfully');
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  // Get database instance
  getDB() {
    return this.db;
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = new Database();