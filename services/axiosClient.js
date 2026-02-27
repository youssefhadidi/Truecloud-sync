import axios from 'axios';
import { store } from '../store';

// Minimal event emitter — avoids Node.js 'events' module (not available in RN)
const _listeners = {};
export const authEvents = {
  on(event, fn) {
    (_listeners[event] ??= []).push(fn);
    return () => this.off(event, fn);
  },
  off(event, fn) {
    _listeners[event] = (_listeners[event] ?? []).filter((l) => l !== fn);
  },
  emit(event, ...args) {
    (_listeners[event] ?? []).forEach((l) => l(...args));
  },
};

const axiosClient = axios.create({
  timeout: 30000,
});

// Request interceptor: set baseURL from Redux store (synchronous — no await needed).
// The session cookie is managed by the native cookie jar (NSURLSession / OkHttp).
axiosClient.interceptors.request.use((config) => {
  const { backendUrl } = store.getState().auth;
  if (backendUrl) {
    config.baseURL = backendUrl;
  }
  return config;
});

// Response interceptor: emit auth:expired on 401/403
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      authEvents.emit('auth:expired');
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
