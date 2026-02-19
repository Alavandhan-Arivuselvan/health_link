
import axios from 'axios';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
// For physical device, replace with your LAN IP (e.g., http://192.168.1.x:9000)
const BASE_URL = "http://10.67.77.22:8000";

console.log('API Base URL configured as:', BASE_URL);

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const authAPI = {
    login: (data: any) => api.post('/login', data),
    register: (data: any) => api.post('/register', data),
    verifyOTP: (data: any) => api.post('/verify-otp', data),
    sendOTP: (data: any) => api.post('/send-otp', data),
};

export const chatAPI = {
    sendMessage: (message: string) => api.post('/chat', { message }),
    uploadFile: (formData: FormData) => api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const statsAPI = {
    saveStats: (stats: any) => api.post('/save-stats', stats),
};

export default api;
