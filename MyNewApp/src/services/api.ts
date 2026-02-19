// import axios from 'axios'; // Removed axios
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
// For physical device, replace with your LAN IP (e.g., http://192.168.1.x:9000)
const BASE_URL = "http://10.67.77.22:9000";

console.log('API Base URL configured as:', BASE_URL);

// Helper to mimic Axios response structure
const fetchClient = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${BASE_URL}${endpoint}`;

    const headers: any = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    // If body is FormData, let the browser set Content-Type (with boundary)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error: any = new Error('API Error');
            error.response = {
                data,
                status: response.status,
            };
            throw error;
        }

        return {
            data,
            status: response.status,
        };
    } catch (error: any) {
        if (error.response) throw error; // Re-throw if it's our structured error
        // Network errors or other
        console.error("Fetch error:", error);
        throw error;
    }
};

export const authAPI = {
    login: (data: any) => fetchClient('/login', { method: 'POST', body: JSON.stringify(data) }),
    register: (data: any) => fetchClient('/register', { method: 'POST', body: JSON.stringify(data) }),
    verifyOTP: (data: any) => fetchClient('/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
    sendOTP: (data: any) => fetchClient('/send-otp', { method: 'POST', body: JSON.stringify(data) }),
};

export const chatAPI = {
    sendMessage: (message: string) => fetchClient('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
    uploadFile: (formData: FormData) => fetchClient('/upload', {
        method: 'POST',
        body: formData,
        // No Content-Type header here, fetchClient handles FormData
    }),
};

export const statsAPI = {
    saveStats: (stats: any) => fetchClient('/save-stats', { method: 'POST', body: JSON.stringify(stats) }),
};

// Default export if needed, though we should prefer named exports
export default {
    ...authAPI,
    ...chatAPI,
    ...statsAPI
};
