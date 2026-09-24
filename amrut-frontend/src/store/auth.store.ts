import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { authAPI, type AuthUser } from "@/services/auth.service";
import {
  getApiErrorMessage,
  isAuthRefusal,
  tokenStorage,
} from "@/services/utils/apiConnector";

// A cold Render instance can take the best part of a minute to answer its first request.
const BOOTSTRAP_ATTEMPTS = 3;
const BOOTSTRAP_RETRY_MS = 1_500;

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  token: string | null;
  logoutError: string | null;
  isLoggingOut: boolean;

  initializeAuth: () => Promise<void>;
  login: (user: AuthUser, accessToken: string) => void;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
  setLoading: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      token: null,
      logoutError: null,
      isLoggingOut: false,

      login: (user, token) => {
        tokenStorage.set(token);
        set({ isAuthenticated: true, user, token, isLoading: false });
      },

      logout: async () => {
        // Best-effort server logout — we clear local state regardless
        const state = useAuthStore.getState();
        if (state.isLoggingOut) return;

        set({ isLoggingOut: true, logoutError: null });
        try {
          await authAPI.logout();
        } catch (error) {
          // The endpoint is idempotent, so this only happens when the network is down.
          set({
            logoutError: getApiErrorMessage(
              error,
              "Could not reach the server. Signed out on this device only.",
            ),
          });
        } finally {
          tokenStorage.clear();
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            isLoggingOut: false,
          });
        }
      },

      setUser: (user) => set({ user }),

      setToken: (token) => set({ token, isAuthenticated: true }),

      setLoading: (isLoading) => set({ isLoading }),

      initializeAuth: async () => {
        // The refresh cookie is the only credential that survives a reload, so this
        // call decides whether the page comes back signed in.
        for (let attempt = 1; attempt <= BOOTSTRAP_ATTEMPTS; attempt += 1) {
          try {
            const refreshed = await authAPI.refresh();
            tokenStorage.set(refreshed.accessToken);

            set({
              isAuthenticated: true,
              user: refreshed.user,
              token: refreshed.accessToken,
              isLoading: false,
            });

            return;
          } catch (error) {
            // The server looked at the credential and said no. That is a real sign-out.
            if (isAuthRefusal(error)) {
              tokenStorage.clear();
              set({
                isAuthenticated: false,
                user: null,
                token: null,
                isLoading: false,
              });

              return;
            }

            // Anything else means the answer never arrived: a sleeping free-tier
            // backend, a slow phone, a dropped connection. Treating that as a sign-out
            // is what makes a perfectly good session disappear on reload.
            if (attempt < BOOTSTRAP_ATTEMPTS) {
              await new Promise((resolve) =>
                setTimeout(resolve, BOOTSTRAP_RETRY_MS * attempt),
              );
            }
          }
        }

        // Out of attempts, still no answer. The session is left as the last visit saw
        // it; the next request that succeeds will refresh the token normally.
        set({ isLoading: false });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    },
  ),
);

if (typeof window !== "undefined") {
  window.addEventListener("auth:logout", () => {
    void useAuthStore.getState().logout();
  });

  // Emitted by the axios layer after a silent refresh.
  window.addEventListener("auth:token-refreshed", (event) => {
    const detail = (event as CustomEvent<{ accessToken?: string }>).detail;
    if (detail?.accessToken) {
      useAuthStore.getState().setToken(detail.accessToken);
    }
  });
}
