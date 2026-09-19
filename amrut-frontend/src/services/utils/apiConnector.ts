import axios from "axios";
import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
  Method,
} from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";
const TOKEN_KEY = "authToken";
const DEVICE_KEY = "amrut:device-id";
let accessToken: string | null = null;

const API_TIMING_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_API_TIMING === "true";

const requestStartTimes = new WeakMap<object, number>();

function logRequestTiming(
  config: { method?: string; url?: string },
  status?: number,
) {
  if (!API_TIMING_ENABLED) {
    return;
  }

  const startedAt = requestStartTimes.get(config);
  if (startedAt === undefined) {
    return;
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const method = (config.method ?? "GET").toUpperCase();
  const url = (config.url ?? "").split("?")[0];
  const statusLabel = status === undefined ? "ERR" : String(status);

  console.info(`[API] ${method} ${url} ${statusLabel} ${durationMs}ms`);
  requestStartTimes.delete(config);
}

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
      const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
      // exp is in seconds; give a 30-second buffer
      return payload.exp != null && payload.exp * 1000 < Date.now() + 30_000;
    } catch {
      return false; // non-JWT or opaque token — let the server decide
    }
  },
};

// ─── Error messages ───────────────────────────────────────────────────────────

/**
 * One place that turns any failure into a sentence worth showing a user.
 *
 * Every layer above (React Query, mutation handlers, the offline queues) reads
 * messages through this, so an error can never reach the screen as "[object
 * Object]", as an empty string, or as nothing at all.
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: unknown; error?: unknown }
      | undefined;

    const serverMessage =
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : typeof data?.error === "string" && data.error.trim()
          ? data.error.trim()
          : null;

    if (serverMessage) return serverMessage;

    if (error.code === "ECONNABORTED") {
      return "The server took too long to respond. Please try again.";
    }

    // No response at all: offline, DNS failure, CORS, server down.
    if (!error.response) {
      return navigator.onLine
        ? "Cannot reach the server. Please try again in a moment."
        : "You are offline. Changes will sync once you reconnect.";
    }

    const status = error.response.status;

    if (status === 401) return "Your session has expired. Please sign in again.";
    if (status === 403) return "You do not have permission to do that.";
    if (status === 404) return "That record could not be found.";
    if (status === 429) return "Too many requests. Please wait a moment and try again.";
    if (status >= 500) return "The server ran into a problem. Please try again.";

    return error.message || fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();

  return fallback;
}

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
    requestStartTimes.set(config, performance.now());
    config.headers.set("X-Device-Id", getDeviceId());
    const token = tokenStorage.get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Silent refresh ───────────────────────────────────────────────────────────

/**
 * Access tokens live for 15 minutes. Without this, the first request made
 * after that mark returned 401 and logged the user out mid-task — several
 * times a shift.
 *
 * On a 401 we exchange the refresh cookie for a new access token once, then
 * replay the request. Concurrent 401s share the single in-flight refresh
 * instead of each firing their own, and each request is retried at most once
 * so a genuinely dead session still ends in a clean logout.
 */
type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

let refreshPromise: Promise<string> | null = null;

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
}

async function refreshAccessToken(): Promise<string> {
  // A bare axios call: the shared instance would recurse through this very
  // interceptor if the refresh itself came back 401.
  const response = await axios.post<{ accessToken: string }>(
    "/auth/refresh",
    undefined,
    {
      baseURL,
      withCredentials: true,
      timeout: 20_000,
      headers: { "X-Device-Id": getDeviceId() },
    },
  );

  const nextToken = response.data?.accessToken;
  if (!nextToken) throw new Error("Refresh did not return an access token");

  tokenStorage.set(nextToken);
  window.dispatchEvent(
    new CustomEvent("auth:token-refreshed", { detail: { accessToken: nextToken } }),
  );

  return nextToken;
}

/** Shared so that ten simultaneous 401s trigger exactly one refresh. */
export function refreshSession(): Promise<string> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Response interceptor — refresh once on 401, then log out
axiosInstance.interceptors.response.use(
  (response) => {
    logRequestTiming(response.config, response.status);
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? "";

    if (config) {
      logRequestTiming(config, status);
    }

    if (status !== 401 || !config || isAuthEndpoint(url) || config._retriedAfterRefresh) {
      if (status === 401 && !isAuthEndpoint(url)) {
        tokenStorage.clear();
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }

      return Promise.reject(error);
    }

    config._retriedAfterRefresh = true;

    try {
      const nextToken = await refreshSession();
      config.headers.set("Authorization", `Bearer ${nextToken}`);
      return await axiosInstance.request(config);
    } catch {
      // The refresh cookie is gone or rejected — this session is genuinely over.
      tokenStorage.clear();
      window.dispatchEvent(new CustomEvent("auth:logout"));
      return Promise.reject(error);
    }
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
