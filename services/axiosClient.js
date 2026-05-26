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

// Singleton in-flight unlock promise. Multiple parallel requests that hit a
// 423 all wait on the same prompt — we don't want to stack PIN modals.
let unlockInFlight = null;

// Response interceptor:
//  - 401/403 → emit auth:expired (root handler clears auth + bounces to /login)
//  - 423     → emit session:locked with a resolver pair; once the modal calls
//              resolve(), retry the original request exactly once.
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      authEvents.emit('auth:expired');
      return Promise.reject(error);
    }

    if (status === 423 && error.config && !error.config._sessionRetry) {
      if (!unlockInFlight) {
        unlockInFlight = new Promise((resolve, reject) => {
          authEvents.emit('session:locked', {
            resolve: () => { unlockInFlight = null; resolve(); },
            reject: (err) => { unlockInFlight = null; reject(err); },
          });
        });
      }
      try {
        await unlockInFlight;
        error.config._sessionRetry = true;
        return axiosClient.request(error.config);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
