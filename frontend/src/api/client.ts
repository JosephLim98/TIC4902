import axios from 'axios';

export interface ApiError extends Error {
  status?: number;
  details?: { field: string; message: string }[] | null;
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the JWT to every outgoing request. Flink/Jar routes require a valid token on the server side
client.interceptors.request.use(config => {
  const token = localStorage.getItem('jwtToken') || sessionStorage.getItem('jwtToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Translate all API errors into clean and human-readable messages
// This runs once here so every API call across the app benefits automatically
client.interceptors.response.use(
  response => response,
  error => {

    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data;

    // Prefer the server's own message, fall back to status-based defaults
    const message = data?.error || data?.message || 
      (status === 400 ? 'Invalid request. Check your inputs and try again' :
       status === 401 ? 'You are not authorised. Please log in again' :
       status === 403 ? 'You do not have permission to perform this action' :
       status === 404 ? 'Resource not found' :
       status === 409 ? 'A conflict occurred. This resource may already exist' :
       status === 422 ? 'The submitted data could not be processed' :
       status === 500 ? 'Server error. Please try again or contact support' :
       error.message || 'An unexpected error occurred'
      );
    
    const apiError = new Error(message) as ApiError;
    apiError.status = status;
    apiError.details = data?.details ?? null;

    return Promise.reject(apiError);
  }
)

export default client;
