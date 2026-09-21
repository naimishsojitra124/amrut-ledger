import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { applyRealtimeToCache } from "@/services/realtime/realtime-cache";
import { realtimeClient } from "@/services/realtime/realtime.client";
import { invalidateFromRealtime } from "@/services/utils/query-invalidation";
import { useAuthStore } from "@/store/auth.store";

// Keeps one socket open per tab and turns each change signal into a refetch of whatever
// happens to be on screen, so a second counter's entry shows up without a reload.
export function RealtimeSync() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    realtimeClient.start();

    const stopChanges = realtimeClient.onChange((event) => {
      // "started" and "error" say something is in flight or failed; neither is a new
      // state to render, and the device that made the change already knows.
      if (event.phase !== "success") return;

      // Write the pushed record straight into the cache, and only ask the server for
      // what the record could not settle on its own.
      const settled = applyRealtimeToCache(queryClient, event).settled;

      if (import.meta.env.DEV) {
        console.info(`[realtime] ${event.type} -> ${settled ? "cache" : "refetch"}`);
      }

      if (settled) return;

      void invalidateFromRealtime(queryClient, event);
    });

    // Anything that happened while the socket was down was never announced.
    const stopResync = realtimeClient.onResync(() => {
      void queryClient.invalidateQueries();
    });

    const wake = () => {
      if (document.visibilityState === "visible") realtimeClient.reconnectNow();
    };

    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);

    return () => {
      stopChanges();
      stopResync();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      realtimeClient.stop();
    };
  }, [isAuthenticated, queryClient]);

  return null;
}
