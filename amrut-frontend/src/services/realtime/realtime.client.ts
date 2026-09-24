import {
  getClientId,
  refreshSession,
  tokenStorage,
} from "@/services/utils/apiConnector";

import type { RealtimeChangeEvent, RealtimeStatus } from "./realtime.types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

// When the API is reached through a same-origin proxy the base is a path, not a URL.
// A proxy cannot carry a websocket upgrade, so the socket needs the backend's own
// origin and VITE_REALTIME_URL has to name it.
const REALTIME_BASE_URL =
  import.meta.env.VITE_REALTIME_URL ??
  (/^https?:\/\//i.test(API_BASE_URL) ? API_BASE_URL : window.location.origin);

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

// The server closes an unauthenticated socket, so there is no point retrying at speed.
const UNAUTHORIZED_CLOSE_CODE = 4401;

const LOG_ENABLED = import.meta.env.DEV || import.meta.env.VITE_API_TIMING === "true";

function log(message: string): void {
  if (LOG_ENABLED) console.info(`[realtime] ${message}`);
}

type ChangeListener = (event: RealtimeChangeEvent) => void;
type StatusListener = (status: RealtimeStatus) => void;
// Fires only after a drop, when events were missed and a blanket refresh is owed.
type ResyncListener = () => void;

function realtimeUrl(): string {
  const url = new URL("/realtime", REALTIME_BASE_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

// Calling close() on a socket that is still negotiating makes the browser log a warning,
// so a pending one is told to hang up the moment it opens instead.
function closeSocket(socket: WebSocket): void {
  socket.onclose = null;
  socket.onmessage = null;
  socket.onerror = null;

  if (socket.readyState === WebSocket.CONNECTING) {
    socket.onopen = () => socket.close(1000, "No longer needed");
    return;
  }

  socket.onopen = null;
  socket.close(1000, "Signed out");
}

function isChangeEvent(frame: unknown): frame is RealtimeChangeEvent {
  if (!frame || typeof frame !== "object") return false;

  const candidate = frame as { kind?: unknown; resource?: unknown };
  return candidate.kind === "change" && typeof candidate.resource === "string";
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: RealtimeStatus = "idle";
  private retryMs = FIRST_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private wanted = false;
  private hasConnectedBefore = false;
  // Refreshing an expired token is awaited, and a remount during that await must not
  // start a second socket that then never gets closed.
  private opening = false;

  private readonly changeListeners = new Set<ChangeListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly resyncListeners = new Set<ResyncListener>();

  // Events are deduplicated because a reconnect can redeliver the frame in flight.
  private readonly seen = new Set<string>();

  start(): void {
    if (this.wanted) return;

    this.wanted = true;
    this.retryMs = FIRST_RETRY_MS;
    void this.open();
  }

  stop(): void {
    this.wanted = false;
    this.clearRetry();
    this.seen.clear();
    this.hasConnectedBefore = false;

    if (this.socket) {
      closeSocket(this.socket);
      this.socket = null;
    }

    this.setStatus("idle");
  }

  onChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onResync(listener: ResyncListener): () => void {
    this.resyncListeners.add(listener);
    return () => this.resyncListeners.delete(listener);
  }

  private setStatus(next: RealtimeStatus): void {
    if (this.status === next) return;

    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }

  private clearRetry(): void {
    if (this.retryTimer === null) return;

    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(): void {
    if (!this.wanted || this.retryTimer !== null) return;

    // Jittered, so a server restart does not bring every tablet back at the same instant.
    const delay = this.retryMs * (0.7 + Math.random() * 0.6);
    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.open();
    }, delay);
  }

  private async open(): Promise<void> {
    if (!this.wanted || this.socket || this.opening) return;

    this.opening = true;

    try {
      await this.connect();
    } finally {
      this.opening = false;

      // A remount that arrived mid-attempt was turned away by the guard above, so the
      // client would otherwise sit wanting a connection with nothing left to make one.
      if (this.wanted && this.socket === null) this.scheduleRetry();
    }
  }

  private async connect(): Promise<void> {
    let token = tokenStorage.get();

    if (token === null || tokenStorage.isExpired()) {
      try {
        token = await refreshSession();
      } catch {
        log("could not refresh the session; retrying");
        this.setStatus("offline");
        this.scheduleRetry();
        return;
      }
    }

    // A remount may have stopped the client while the refresh was in flight.
    if (!this.wanted || this.socket) return;

    this.setStatus("connecting");

    let socket: WebSocket;

    try {
      socket = new WebSocket(realtimeUrl());
    } catch {
      this.setStatus("offline");
      this.scheduleRetry();
      return;
    }

    this.socket = socket;
    const authToken = token;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({ type: "auth", token: authToken, clientId: getClientId() }),
      );
    };

    socket.onmessage = (message: MessageEvent<string>) => {
      this.handleFrame(message.data);
    };

    socket.onerror = () => {
      // onclose always follows, and that is where reconnecting is handled.
    };

    socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      this.setStatus("offline");
      log(`disconnected (code ${event.code})`);

      if (!this.wanted) return;

      // A rejected token will be rejected again immediately; wait for the refresh cycle.
      if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        this.retryMs = Math.max(this.retryMs, 5_000);
      }

      this.scheduleRetry();
    };
  }

  private handleFrame(raw: string): void {
    let frame: unknown;

    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }

    if (!frame || typeof frame !== "object") return;

    const kind = (frame as { kind?: unknown }).kind;

    if (kind === "ready") {
      this.retryMs = FIRST_RETRY_MS;
      this.setStatus("live");
      log("connected");

      if (this.hasConnectedBefore) {
        for (const listener of this.resyncListeners) listener();
      }

      this.hasConnectedBefore = true;
      return;
    }

    if (!isChangeEvent(frame)) return;

    if (this.seen.has(frame.id)) return;
    this.seen.add(frame.id);

    if (this.seen.size > 500) {
      const oldest = this.seen.values().next();
      if (!oldest.done) this.seen.delete(oldest.value);
    }

    log(frame.data === undefined ? `${frame.type} (no payload)` : frame.type);

    for (const listener of this.changeListeners) listener(frame);
  }

  // A tab that slept through a change has no way to know, so treat waking as a drop.
  reconnectNow(): void {
    if (!this.wanted || this.socket || this.opening) return;

    this.clearRetry();
    this.retryMs = FIRST_RETRY_MS;
    void this.open();
  }
}

export const realtimeClient = new RealtimeClient();
