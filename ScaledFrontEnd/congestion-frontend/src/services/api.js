import axios from 'axios';

// ─── Base API Client ────────────────────────────────────────────
const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api', 
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── JWT Auth Interceptor ───────────────────────────────────────
// Automatically attaches the JWT token to every outgoing request
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ─── 401 Response Interceptor ───────────────────────────────────
// If backend returns 401, the token is expired/invalid → force logout
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Don't redirect if already on login/register endpoints
            if (!error.config.url.includes('/auth/')) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ─── Auth Service ───────────────────────────────────────────────
export const AuthService = {
    login: async (username, password) => {
        const response = await apiClient.post('/auth/login', { username, password });
        const { token, username: user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('username', user);
        return response.data;
    },

    register: async (username, email, password) => {
        const response = await apiClient.post('/auth/register', { username, email, password });
        const { token, username: user } = response.data;
        localStorage.setItem('token', token);
        localStorage.setItem('username', user);
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    getUsername: () => {
        return localStorage.getItem('username');
    }
};

// ─── Experiment Service ─────────────────────────────────────────
export const ExperimentService = {
    // Matches: POST /api/experiments
    createExperiment: async (payload) => {
        const response = await apiClient.post('/experiments', payload);
        return response.data;
    },

    // Matches: POST /api/experiments/{experimentId}/start
    startExperiment: async (experimentId, modelName) => {
        const response = await apiClient.post(`/experiments/${experimentId}/start`, null, {
            params: { model: modelName }
        });
        return response.data;
    },
    
    // Matches: POST /api/experiments/{experimentId}/end
    endExperiment: async (experimentId) => {
        const response = await apiClient.post(`/experiments/${experimentId}/end`);
        return response.data;
    },
    
    // Matches: GET /api/experiments
    getAllExperiments: async () => {
        const response = await apiClient.get('/experiments'); 
        return response.data;
    },

    // Matches: GET /api/experiments/{experimentId}
    getExperimentById: async (experimentId) => {
        const response = await apiClient.get(`/experiments/${experimentId}`);
        return response.data;
    },

    // Matches: GET /api/experiments/{experimentId}/queue-position
    getQueuePosition: async (experimentId) => {
        const response = await apiClient.get(`/experiments/${experimentId}/queue-position`);
        return response.data;
    }
};

// ─── Flow Service ───────────────────────────────────────────────
export const FlowService = {
    // Matches: GET /api/experiments/{experimentId}/flows
    getFlowsByExperiment: async (experimentId) => {
        const response = await apiClient.get(`/experiments/${experimentId}/flows`);
        return response.data;
    }
};

// ─── Training Service ───────────────────────────────────────────
export const TrainingService = {
    // POST /api/training/start
    startTraining: async (experimentId, totalTimesteps, learningRate, networkArch) => {
        const response = await apiClient.post('/training/start', {
            experimentId,
            totalTimesteps,
            learningRate: learningRate || 3e-4,
            networkArch: networkArch || '256,256,128',
        });
        return response.data;
    },

    // POST /api/training/{id}/stop
    stopTraining: async (trainingRunId) => {
        const response = await apiClient.post(`/training/${trainingRunId}/stop`);
        return response.data;
    },

    // GET /api/training/runs
    getTrainingRuns: async () => {
        const response = await apiClient.get('/training/runs');
        return response.data;
    },

    // GET /api/training/{id}/status
    getTrainingStatus: async (trainingRunId) => {
        const response = await apiClient.get(`/training/${trainingRunId}/status`);
        return response.data;
    },
};

// ─── Model Service ──────────────────────────────────────────────
export const ModelService = {
    // GET /api/models/all
    getAllModels: async () => {
        const response = await apiClient.get('/models/all');
        return response.data;
    },

    // GET /api/models/experiment/{experimentId}
    getModelsForExperiment: async (experimentId) => {
        const response = await apiClient.get(`/models/experiment/${experimentId}`);
        return response.data;
    },
};