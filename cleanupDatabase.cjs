const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'schedule.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    
    // Delete all tasks
    db.run('DELETE FROM tasks', function(err) {
      if (err) {
        console.error('Error deleting tasks:', err);
      } else {
        console.log(`Deleted ${this.changes} tasks`);
      }
      
      // Delete all plans
      db.run('DELETE FROM plans', function(err) {
        if (err) {
          console.error('Error deleting plans:', err);
        } else {
          console.log(`Deleted ${this.changes} plans`);
        }
        
        // Delete all users (optional - uncomment if you want to delete users too)
        // db.run('DELETE FROM users', function(err) {
        //   if (err) {
        //     console.error('Error deleting users:', err);
        //   } else {
        //     console.log(`Deleted ${this.changes} users`);
        //   }
          
          // Reset all auto-increment counters
          db.run("DELETE FROM sqlite_sequence WHERE name='tasks'", (err) => {
            if (err) {
              console.error('Error resetting tasks auto-increment:', err);
            } else {
              console.log('Tasks auto-increment counter reset');
            }
            
            db.run("DELETE FROM sqlite_sequence WHERE name='plans'", (err) => {
              if (err) {
                console.error('Error resetting plans auto-increment:', err);
              } else {
                console.log('Plans auto-increment counter reset');
              }
              
              // Uncomment below if you also want to reset users auto-increment
              // db.run("DELETE FROM sqlite_sequence WHERE name='users'", (err) => {
              //   if (err) {
              //     console.error('Error resetting users auto-increment:', err);
              //   } else {
              //     console.log('Users auto-increment counter reset');
              //   }
                
                // Close the database connection
                db.close((err) => {
                  if (err) {
                    console.error('Error closing database:', err);
                  } else {
                    console.log('Database connection closed');
                    console.log('Cleanup completed successfully!');
                  }
                });
              // });
            });
          });
        // });
      });
    });
  }
});