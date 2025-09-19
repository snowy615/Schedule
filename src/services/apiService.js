const API_BASE_URL = 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('auth-token');
  }

  // Set authentication token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth-token', token);
    } else {
      localStorage.removeItem('auth-token');
    }
  }

  // Get authentication headers
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  // Generic API call method
  async apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API call failed');
      }

      return data;
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(email, password) {
    const data = await this.apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async signup(email, password, name) {
    const data = await this.apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    if (data.token) {
      this.setToken(data.token);
    }
    
    return data;
  }

  async getCurrentUser() {
    return this.apiCall('/auth/me');
  }

  // User lookup method
  async lookupUser(email) {
    const data = await this.apiCall(`/auth/lookup/${encodeURIComponent(email)}`);
    return data.user;
  }

  logout() {
    this.setToken(null);
  }

  // Task methods
  async getTasks() {
    const data = await this.apiCall('/tasks');
    return data.tasks;
  }

  async getTasksByDate(date) {
    const data = await this.apiCall(`/tasks/date/${date}`);
    return data.tasks;
  }

  async createTask(taskData) {
    const data = await this.apiCall('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
    return data.task;
  }

  // Update a task (this might affect plan completion status)
  async updateTask(id, updates) {
    console.log('API Service - Updating task:', id, updates);
    try {
      const data = await this.apiCall(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      console.log('API Service - Task updated successfully:', data.task);
      return data.task;
    } catch (error) {
      console.error('API Service - Failed to update task:', error);
      throw error;
    }
  }

  async toggleTask(id) {
    const data = await this.apiCall(`/tasks/${id}/toggle`, {
      method: 'PATCH',
    });
    return data.task;
  }

  async deleteTask(id) {
    return this.apiCall(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async generateNextOccurrence(id) {
    const data = await this.apiCall(`/tasks/${id}/generate-next`, {
      method: 'POST',
    });
    return data.task;
  }

  // Plan methods
  async getPlans() {
    const data = await this.apiCall('/plans');
    return data.plans;
  }

  async getPlansByDate(date) {
    const data = await this.apiCall(`/plans/date/${date}`);
    return data.plans;
  }

  async createPlan(planData) {
    const data = await this.apiCall('/plans', {
      method: 'POST',
      body: JSON.stringify(planData),
    });
    return data.plan;
  }

  async getPlan(id) {
    console.log('API Service - Getting plan:', id);
    try {
      const data = await this.apiCall(`/plans/${id}`);
      console.log('API Service - Got plan:', id, data.plan);
      return data.plan;
    } catch (error) {
      console.error('API Service - Failed to get plan:', id, error);
      throw error;
    }
  }

  async getCurrentTask(planId) {
    const data = await this.apiCall(`/plans/${planId}/current-task`);
    return data.task;
  }

  async completeCurrentTask(planId) {
    console.log('API Service - Completing current task for plan:', planId);
    try {
      const data = await this.apiCall(`/plans/${planId}/complete-task`, {
        method: 'PATCH',
      });
      console.log('API Service - Task completed successfully for plan:', planId, data.plan);
      return data.plan;
    } catch (error) {
      console.error('API Service - Failed to complete task for plan:', planId, error);
      // Re-throw the error so it can be handled by the caller
      throw error;
    }
  }

  // Set individual task completion status
  async setIndividualTaskStatus(planId, taskId, completed) {
    const data = await this.apiCall(`/plans/${planId}/tasks/${taskId}/individual-complete`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
    return data;
  }

  async deletePlan(id) {
    return this.apiCall(`/plans/${id}`, {
      method: 'DELETE',
    });
  }

  async addTaskToPlan(planId, taskData) {
    const data = await this.apiCall(`/plans/${planId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
    return data.plan;
  }

  // Update a task in a plan
  async updatePlanTask(planId, taskId, updates) {
    console.log('API Service - Updating plan task:', planId, taskId, updates);
    try {
      const data = await this.apiCall(`/plans/${planId}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      console.log('API Service - Plan task updated successfully:', data.plan);
      return data.plan;
    } catch (error) {
      console.error('API Service - Failed to update plan task:', error);
      throw error;
    }
  }

  // Delete a task from a plan
  async deletePlanTask(planId, taskId) {
    const data = await this.apiCall(`/plans/${planId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
    return data.plan;
  }

  // Share a plan with another user
  async sharePlan(planId, email, permissions = 'read') {
    const data = await this.apiCall(`/plans/${planId}/share`, {
      method: 'POST',
      body: JSON.stringify({ email, permissions }),
    });
    return data;
  }

  // Unshare a plan with a user
  async unsharePlan(planId, email) {
    const data = await this.apiCall(`/plans/${planId}/unshare`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return data;
  }

  // Get users a plan is shared with
  async getSharedUsers(planId) {
    const data = await this.apiCall(`/plans/${planId}/shared-users`);
    return data.sharedUsers;
  }
}

export default new ApiService();