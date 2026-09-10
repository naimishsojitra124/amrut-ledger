import axios from "axios";
import type { Method, AxiosRequestHeaders, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const TOKEN_KEY = "authToken";
const DEVICE_KEY = "amrut:device-id";
let accessToken: string | null = null;

export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const deviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}

export const tokenStorage = {
  get(): string | null {
    return accessToken;
  },
  set(token: string): void {
    accessToken = token;
  },
  clear(): void {
    accessToken = null;
    // Remove tokens persisted by older releases.
    localStorage.removeItem(TOKEN_KEY);
  },
  /** Lightweight expiry check — avoids a round-trip for obviously stale JWTs */
  isExpired(): boolean {
    const token = this.get();
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // exp is in seconds; give a 30-second buffer
      return payload.exp != null && payload.exp * 1000 < Date.now() + 30_000;
    } catch {
      return false; // non-JWT or opaque token — let the server decide
    }
  },
};

// ─── Axios instance ───────────────────────────────────────────────────────────

export const axiosInstance = axios.create({
  baseURL,
  timeout: 60_000,
  headers: {
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
  },
  withCredentials: true,
});

// Request interceptor — attach token
axiosInstance.interceptors.request.use(
  (config) => {
    config.headers.set("X-Device-Id", getDeviceId());
    const token = tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? "";

    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");

    if (status === 401 && !isAuthEndpoint) {
      tokenStorage.clear();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }

    return Promise.reject(error);
  },
);

// ─── Generic connector ────────────────────────────────────────────────────────

export const apiConnector = async <T>(
  method: Method,
  url: string,
  bodyData?: unknown,
  headers?: AxiosRequestHeaders,
  params?: Record<string, unknown>,
  signal?: AbortSignal, // Accept the caller's signal directly — no wrapper needed
): Promise<AxiosResponse<T>> => {
  return axiosInstance<T>({
    method,
    url,
    data: bodyData,
    headers,
    params,
    signal, // Axios handles AbortSignal natively since v0.22
  });
};
