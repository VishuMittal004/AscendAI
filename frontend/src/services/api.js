import axios from 'axios';

const API_URL = 'https://ascendai-rr35.onrender.com';

const api = axios.create({
    baseURL: API_URL,
    timeout: 120000, // 2 min for AI generation
    headers: { 'Content-Type': 'application/json' }
});

export const getQuote = async () => {
    const response = await api.get('/quote');
    return response.data;
};

// ─── Auth Token Injection ──────────────────────────────────────────────────
// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('ascendai_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── Auth ──────────────────────────────────────────────────────────────────

export const register = async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
};

export const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    // Store JWT in localStorage
    localStorage.setItem('ascendai_token', response.data.access_token);
    localStorage.setItem('ascendai_user', JSON.stringify({
        username: response.data.username,
        email: response.data.email
    }));
    return response.data;
};

export const logout = () => {
    localStorage.removeItem('ascendai_token');
    localStorage.removeItem('ascendai_user');
};

export const getStoredUser = () => {
    const user = localStorage.getItem('ascendai_user');
    return user ? JSON.parse(user) : null;
};

export const isTokenStored = () => !!localStorage.getItem('ascendai_token');

// ─── Sessions ──────────────────────────────────────────────────────────────

export const createNewSession = async () => {
    const response = await api.post('/sessions/new');
    return response.data;
};

export const getSessions = async () => {
    const response = await api.get('/sessions');
    return response.data;
};

export const getSessionTasks = async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/tasks`);
    return response.data;
};

export const analyzeSession = async (sessionId) => {
    const response = await api.get(`/sessions/${sessionId}/analyze`);
    return response.data;
};

// ─── Tasks & Stats ─────────────────────────────────────────────────────────

export const getTasks = async () => {
    const response = await api.get('/tasks');
    return response.data;
};

export const toggleTask = async (taskId) => {
    const response = await api.post(`/tasks/${taskId}/toggle`);
    return response.data;
};

export const getStats = async () => {
    const response = await api.get('/stats');
    return response.data;
};

// ─── Plan Generation ───────────────────────────────────────────────────────

export const generatePlan = async (goal, days, hours, forceRegenerate = false, difficulty = "Intermediate", includeResources = false, file = null) => {
    const formData = new FormData();
    formData.append('goal', goal);
    formData.append('days', parseInt(days));
    formData.append('hours_per_day', parseInt(hours));
    formData.append('force_regenerate', forceRegenerate);
    formData.append('difficulty', difficulty);
    formData.append('include_resources', includeResources);
    if (file) {
        formData.append('file', file);
    }
    
    // Pass headers explicitly for this request to override the default JSON content type
    const response = await api.post('/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const addGoalToPlan = async (newGoal, days, hours, difficulty = "Intermediate", includeResources = false, file = null) => {
    const formData = new FormData();
    formData.append('new_goal', newGoal);
    formData.append('days', parseInt(days));
    formData.append('hours_per_day', parseInt(hours));
    formData.append('difficulty', difficulty);
    formData.append('include_resources', includeResources);
    if (file) {
        formData.append('file', file);
    }

    const response = await api.post('/add-goal', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

// Legacy alias for reset — now creates a new session instead
export const resetAll = async () => {
    return createNewSession();
};

export const recalibrateTasks = async (dayNumber = null) => {
    const payload = dayNumber !== null ? { day_number: dayNumber } : null;
    const response = await api.post('/tasks/recalibrate', payload);
    return response.data;
};

// ─── Quick Notes ────────────────────────────────────────────────────────────

export const getNotes = async () => {
    const response = await api.get('/notes');
    return response.data;
};

export const saveNotes = async (content) => {
    const response = await api.put('/notes', { content });
    return response.data;
};

export const exportData = async () => {
    const response = await api.get('/export');
    return response.data;
};

