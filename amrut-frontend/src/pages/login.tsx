import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { authAPI } from "@/services/auth.service";
import { getApiErrorMessage } from "@/services/utils/apiConnector";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState("");
  const [slowRequest, setSlowRequest] = useState(false);

  /**
   * Only offer the demo where one exists. A deployment without DEMO_MODE
   * reports `demoMode: false` and the button never appears.
   */
  const demoConfig = useQuery({
    queryKey: ["auth", "config"],
    queryFn: authAPI.config,
    staleTime: Infinity,
    retry: false,
    meta: { suppressErrorToast: true },
  });

  // Only shown where a demo exists; a normal deployment reports demoMode: false.
  const demoCredentials = demoConfig.data?.demoMode
    ? (demoConfig.data.demoCredentials ?? null)
    : null;

  const getPostLoginPath = useCallback(() => {
    const from = location.state?.from;

    if (
      from &&
      typeof from.pathname === "string" &&
      from.pathname !== "/login"
    ) {
      return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
    }

    return "/dashboard";
  }, [location.state]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(getPostLoginPath(), {
        replace: true,
      });
    }
  }, [getPostLoginPath, isAuthenticated, isLoading, navigate]);

  const handleLogin = async () => {
    setError("");

    if (!mobileNumber.trim()) {
      setError("Enter mobile number.");
      return;
    }

    if (!password.trim()) {
      setError("Enter password.");
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login({
        mobileNumber: mobileNumber.trim(),
        password,
      });

      login(response.user, response.accessToken);

      navigate(getPostLoginPath(), {
        replace: true,
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed."));
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemoCredentials = async () => {
    if (!demoCredentials) return;

    setError("");
    setMobileNumber(demoCredentials.mobileNumber);
    setPassword(demoCredentials.password);
    setGuestLoading(true);

    try {
      const response = await authAPI.login({
        mobileNumber: demoCredentials.mobileNumber,
        password: demoCredentials.password,
      });

      login(response.user, response.accessToken);
      navigate(getPostLoginPath(), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start the demo."));
    } finally {
      setGuestLoading(false);
    }
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        void handleLogin();
      }
    },
    [mobileNumber, password],
  );

  // The demo backend sleeps when idle and its first request pays the wake-up cost.
  // Saying so beats a button that looks stuck.
  useEffect(() => {
    if (!loading && !guestLoading) return;

    const timer = setTimeout(() => setSlowRequest(true), 4000);

    // Clearing on the way out covers both a finished sign-in and a failed one.
    return () => {
      clearTimeout(timer);
      setSlowRequest(false);
    };
  }, [loading, guestLoading]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Amrut Ledger
          </h1>

          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mobile Number
            </label>

            <input
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              placeholder="9876543210"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 outline-none focus:border-slate-500"
                placeholder="Password"
              />

              {password && (
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center space-x-1 transition-opacity duration-200">
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {!showPassword ? (
                      <EyeIcon className="h-5 w-5 text-neutral-600" />
                    ) : (
                      <EyeOffIcon className="h-5 w-5 text-neutral-600" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          {slowRequest ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Waking the demo server. The free hosting tier sleeps when idle, so
              the first sign-in can take up to a minute.
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading || guestLoading || !mobileNumber || !password}
            className="w-full rounded-lg py-5 text-white disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>

          {demoCredentials && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => void handleUseDemoCredentials()}
                disabled={loading || guestLoading}
                className="w-full rounded-lg py-5 disabled:cursor-not-allowed"
              >
                {guestLoading ? "Signing in..." : "Sign in as guest"}
              </Button>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-medium text-slate-700">Demo credentials</p>

                <p className="mt-1 font-mono">
                  {demoCredentials.mobileNumber} / {demoCredentials.password}
                </p>

                <p className="mt-1.5 text-slate-500">
                  Sample data with full access — try anything. Everything resets
                  {demoConfig.data?.demoResetIntervalHours
                    ? ` every ${demoConfig.data.demoResetIntervalHours} hours.`
                    : " periodically."}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
