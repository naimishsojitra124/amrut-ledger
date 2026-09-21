import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { authAPI, type AuthUser } from "@/services/auth.service";
import { getApiErrorMessage, tokenStorage } from "@/services/utils/apiConnector";

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
        try {
          // The refresh cookie is the only persistent credential.
          const refreshed = await authAPI.refresh();
          tokenStorage.set(refreshed.accessToken);

          set({
            isAuthenticated: true,
            user: refreshed.user,
            token: refreshed.accessToken,
            isLoading: false,
          });
        } catch {
          tokenStorage.clear();
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
          });
        }
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
