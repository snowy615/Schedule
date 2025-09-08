// Test script for shared plans functionality
const apiService = require('./src/services/apiService');

async function testSharedPlans() {
  try {
    console.log('Testing shared plans functionality...');
    
    // Test sharing a plan
    const planId = 1; // Replace with an actual plan ID
    const email = 'test@example.com'; // Replace with an actual user email
    const permissions = 'read';
    
    console.log(`Sharing plan ${planId} with user ${email}...`);
    
    // This would be the API call to share a plan
    // const result = await apiService.sharePlan(planId, email, permissions);
    // console.log('Share result:', result);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSharedPlans();