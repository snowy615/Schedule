// Utility function to determine if a plan is effectively completed
// A plan is considered completed if:
// 1. Its completed flag is set to true, OR
// 2. All of its tasks are completed
export function isPlanCompleted(plan) {
  // If the plan is explicitly marked as completed, return true
  if (plan.completed) {
    return true;
  }
  
  // If the plan has tasks, check if all tasks are completed
  if (plan.tasks && plan.tasks.length > 0) {
    return plan.tasks.every(task => task.completed);
  }
  
  // If the plan has no tasks, we consider it not completed
  return false;
}

// Utility function to get active plans (plans that are not completed)
export function getActivePlans(plans) {
  return plans.filter(plan => !isPlanCompleted(plan));
}