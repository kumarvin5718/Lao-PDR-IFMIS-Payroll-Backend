/**
 * Shared Axios instance: base URL, `Authorization` header, 401 → refresh-token queue.
 * Prefer `apiFetch` for simple GETs that unwrap `ApiEnvelope`.
 */
import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL } from "@/config/constants";
import { useAuthStore } from "@/store/authStore";
import type { ApiEnvelope } from "@/types/auth";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

/** GET `/api/v1` + path; returns unwrapped `data` from `ApiEnvelope`. */
export async function apiFetch<T>(path: string): Promise<T> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const { data } = await apiClient.get<ApiEnvelope<T>>(`/api/v1${p}`);
  if (!data.success || data.data === null) {
    throw new Error("api");
  }
  return data.data;
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function onRefreshed(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function isAuthBypassPath(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/register") ||
    url.includes("/employees/check-duplicate") ||
    url.includes("/lookups/provinces") ||
    url.includes("/lookups/departments")
  );
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    if (isAuthBypassPath(original.url)) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((token) => {
          if (!token) {
            reject(error);
            return;
          }
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post<ApiEnvelope<{ access_token: string; token_type: string; force_password_change: boolean }>>(
        `${API_BASE_URL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true },
      );
      if (!data.success || !data.data?.access_token) {
        throw new Error("Refresh failed");
      }
      const next = data.data.access_token;
      useAuthStore.getState().setAccessToken(next);
      onRefreshed(next);
      original.headers.Authorization = `Bearer ${next}`;
      return apiClient(original);
    } catch {
      useAuthStore.getState().clear();
      onRefreshed(null);
      window.location.assign("/login");
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
