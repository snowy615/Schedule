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

  async updateTask(id, updates) {
    const data = await this.apiCall(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return data.task;
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
    const data = await this.apiCall(`/plans/${id}`);
    return data.plan;
  }

  async getCurrentTask(planId) {
    const data = await this.apiCall(`/plans/${planId}/current-task`);
    return data.task;
  }

  async completeCurrentTask(planId) {
    const data = await this.apiCall(`/plans/${planId}/complete-task`, {
      method: 'PATCH',
    });
    return data.plan;
  }

  async deletePlan(id) {
    return this.apiCall(`/plans/${id}`, {
      method: 'DELETE',
    });
  }
}

export default new ApiService();