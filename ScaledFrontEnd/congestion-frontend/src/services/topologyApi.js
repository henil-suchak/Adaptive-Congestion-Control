import axios from 'axios';

const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api',
    headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const TopologyService = {
    create: async (topology) => {
        const res = await apiClient.post('/topologies', topology);
        return res.data;
    },
    getAll: async () => {
        const res = await apiClient.get('/topologies');
        return res.data;
    },
    getById: async (id) => {
        const res = await apiClient.get(`/topologies/${id}`);
        return res.data;
    },
    update: async (id, topology) => {
        const res = await apiClient.put(`/topologies/${id}`, topology);
        return res.data;
    },
    delete: async (id) => {
        await apiClient.delete(`/topologies/${id}`);
    },
};
