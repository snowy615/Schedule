const database = require('./database');

async function migratePlanCompletionStatus() {
  const db = database.getDB();
  
  return new Promise((resolve, reject) => {
    // Get all plans with their user_id and completed status
    db.all(`
      SELECT id, user_id, completed, updated_at
      FROM plans
      WHERE completed = 1
    `, (err, plans) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (plans.length === 0) {
        console.log('No completed plans to migrate');
        resolve();
        return;
      }
      
      console.log(`Migrating ${plans.length} completed plans`);
      
      // Insert completion status for each plan owner
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO plan_completion_status 
        (plan_id, user_id, completed, completed_at, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      let completed = 0;
      
      plans.forEach(plan => {
        const completedAt = plan.updated_at; // Use plan's updated_at as completion time
        stmt.run([
          plan.id, 
          plan.user_id, 
          plan.completed, 
          completedAt,
          completedAt,
          completedAt
        ], (insertErr) => {
          if (insertErr) {
            console.error('Error inserting plan completion status:', insertErr);
          } else {
            completed++;
            if (completed === plans.length) {
              console.log(`Successfully migrated ${completed} plan completion statuses`);
              stmt.finalize();
              resolve();
            }
          }
        });
      });
    });
  });
}

// Run the migration
database.init()
  .then(() => {
    console.log('Database initialized');
    return migratePlanCompletionStatus();
  })
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });