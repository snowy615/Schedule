const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, 'schedule.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    
    // Delete all plans (this will also delete associated tasks due to foreign key constraints)
    db.run('DELETE FROM plans', function(err) {
      if (err) {
        console.error('Error deleting plans:', err);
      } else {
        console.log(`Deleted ${this.changes} plans`);
        
        // Reset the auto-increment counter for plans
        db.run("DELETE FROM sqlite_sequence WHERE name='plans'", (err) => {
          if (err) {
            console.error('Error resetting plans auto-increment:', err);
          } else {
            console.log('Plans auto-increment counter reset');
          }
          
          // Close the database connection
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err);
            } else {
              console.log('Database connection closed');
            }
          });
        });
      }
    });
  }
});