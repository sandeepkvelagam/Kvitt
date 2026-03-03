import axios from "axios";
import { supabase } from "../lib/supabase";

const apiUrl = process.env.EXPO_PUBLIC_API_URL!;

if (!apiUrl) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in .env");
}

export const api = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
});

// Add auth token to all requests
api.interceptors.request.use(
  async (config) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting session for API request:", error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with 401 retry logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and haven't retried yet, refresh token and retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !data.session) {
          console.error("Token refresh failed - user needs to re-login");
          return Promise.reject(error);
        }

        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
