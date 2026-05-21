import axios from 'axios';

// 1. Configure the base connection to your Spring Boot backend
const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api', 
    headers: {
        'Content-Type': 'application/json',
    },
});

export const ExperimentService = {
    // Matches: POST /api/experiments
    createExperiment: async (payload) => {
        const response = await apiClient.post('/experiments', payload);
        return response.data;
    },

    // Matches: POST /api/experiments/{experimentId}/start
    // FIX: Added modelName to arguments and correctly placed params inside the post request
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
    // FIX: Changed .post to .get
    getAllExperiments: async () => {
        const response = await apiClient.get('/experiments'); 
        return response.data;
    }
};

export const FlowService = {
    // Matches: GET /api/experiments/{experimentId}/flows
    getFlowsByExperiment: async (experimentId) => {
        const response = await apiClient.get(`/experiments/${experimentId}/flows`);
        return response.data;
    }
};