import { randomUUID } from "node:crypto";

import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";

import { roleHasPermission } from "@/app/auth/permissions";
import type { UserRole } from "../../../generated/prisma/enums";

import {
  RESOURCE_VIEW_PERMISSION,
  realtimeEventType,
  type RealtimeActor,
  type RealtimeChange,
  type RealtimeChangeEvent,
  type RealtimePhase,
  type RealtimeServerFrame,
} from "./realtime.types.js";

// A socket that has not proved who it is holds a file descriptor for nothing.
const AUTH_GRACE_MS = 10_000;

// Render's proxy drops a connection that goes quiet, so the server pings first.
const HEARTBEAT_MS = 30_000;

const MAX_CONNECTIONS = 250;
const MAX_CONNECTIONS_PER_IP = 12;

// Past this, pushing the record costs more than letting the client refetch it.
const MAX_PUSHED_PAYLOAD_BYTES = 64 * 1024;

const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_TOO_MANY = 4429;

interface Connection {
  id: string;
  socket: WebSocket;
  ip: string;
  userId: string | null;
  role: UserRole | null;
  // The tab that made the change, so it is not told to refetch what it just wrote.
  clientId: string | null;
  isAlive: boolean;
  authTimer: NodeJS.Timeout | null;
}

export interface PublishInput extends RealtimeChange {
  phase: RealtimePhase;
  requestId: string;
  method: string;
  url: string;
  route: string;
  status?: number | null | undefined;
  actor?: RealtimeActor | null | undefined;
  originClientId?: string | null | undefined;
  data?: unknown;
  error?: { message: string } | null | undefined;
}

// Fan-out lives in this process only. A second instance would broadcast to its own
// sockets and nothing else, so this service must stay on one instance until the
// registry moves to Redis or another shared bus.
export class RealtimeHub {
  private readonly connections = new Map<string, Connection>();
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(private readonly log: FastifyBaseLogger) {}

  get connectionCount(): number {
    return this.connections.size;
  }

  private countForIp(ip: string): number {
    let total = 0;
    for (const connection of this.connections.values()) {
      if (connection.ip === ip) total += 1;
    }
    return total;
  }

  private send(connection: Connection, frame: RealtimeServerFrame): void {
    // 1 is WebSocket.OPEN; anything else is closing and would throw.
    if (connection.socket.readyState !== 1) return;

    try {
      connection.socket.send(JSON.stringify(frame));
    } catch (error) {
      this.log.debug({ err: error, connectionId: connection.id }, "realtime send failed");
    }
  }

  accept(socket: WebSocket, ip: string): Connection | null {
    if (this.connections.size >= MAX_CONNECTIONS || this.countForIp(ip) >= MAX_CONNECTIONS_PER_IP) {
      socket.close(CLOSE_TOO_MANY, "Too many connections");
      return null;
    }

    const connection: Connection = {
      id: randomUUID(),
      socket,
      ip,
      userId: null,
      role: null,
      clientId: null,
      isAlive: true,
      authTimer: null,
    };

    connection.authTimer = setTimeout(() => {
      if (connection.userId === null) {
        socket.close(CLOSE_UNAUTHORIZED, "Authentication timed out");
      }
    }, AUTH_GRACE_MS);

    this.connections.set(connection.id, connection);
    this.ensureHeartbeat();

    return connection;
  }

  authenticate(
    connection: Connection,
    userId: string,
    role: UserRole,
    clientId: string | null,
  ): void {
    if (connection.authTimer) {
      clearTimeout(connection.authTimer);
      connection.authTimer = null;
    }

    connection.userId = userId;
    connection.role = role;
    connection.clientId = clientId;

    this.send(connection, {
      kind: "ready",
      connectionId: connection.id,
      at: new Date().toISOString(),
    });
  }

  reject(connection: Connection, message: string): void {
    this.send(connection, { kind: "error", code: "unauthorized", message });
    connection.socket.close(CLOSE_UNAUTHORIZED, "Unauthorized");
  }

  markAlive(connection: Connection): void {
    connection.isAlive = true;
  }

  drop(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    if (connection.authTimer) clearTimeout(connection.authTimer);
    this.connections.delete(connectionId);

    if (this.connections.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  publish(input: PublishInput): void {
    if (this.connections.size === 0) return;

    const base: RealtimeChangeEvent = {
      kind: "change",
      type: realtimeEventType(input.resource, input.action, input.phase),
      resource: input.resource,
      action: input.action,
      phase: input.phase,
      id: randomUUID(),
      at: new Date().toISOString(),
      requestId: input.requestId,
      method: input.method,
      url: input.url,
      route: input.route,
      status: input.status ?? null,
      entityId: input.entityId,
      customerId: input.customerId,
      actor: input.actor ?? null,
      error: input.error ?? null,
    };

    const permission = RESOURCE_VIEW_PERMISSION[input.resource];
    const payload = this.affordablePayload(input.data);
    const originClientId = input.originClientId ?? null;

    for (const connection of this.connections.values()) {
      if (connection.userId === null || connection.role === null) continue;

      // A failure is the actor's business, not something to announce to the shop.
      if (input.phase === "error" && connection.userId !== input.actor?.id) continue;

      if (originClientId !== null && connection.clientId === originClientId) continue;

      const mayRead = roleHasPermission(connection.role, permission);

      this.send(
        connection,
        mayRead && payload !== undefined ? { ...base, data: payload } : base,
      );
    }
  }

  // Serialised once rather than per connection, and dropped when it is large enough
  // that refetching is the cheaper option.
  private affordablePayload(data: unknown): unknown {
    if (data === undefined || data === null) return undefined;

    try {
      const size = Buffer.byteLength(JSON.stringify(data), "utf8");
      return size <= MAX_PUSHED_PAYLOAD_BYTES ? data : undefined;
    } catch {
      return undefined;
    }
  }

  private ensureHeartbeat(): void {
    if (this.heartbeat) return;

    this.heartbeat = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (!connection.isAlive) {
          connection.socket.terminate();
          this.drop(connection.id);
          continue;
        }

        connection.isAlive = false;
        try {
          connection.socket.ping();
        } catch {
          connection.socket.terminate();
          this.drop(connection.id);
        }
      }
    }, HEARTBEAT_MS);

    this.heartbeat.unref?.();
  }

  async close(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    for (const connection of this.connections.values()) {
      if (connection.authTimer) clearTimeout(connection.authTimer);
      connection.socket.close(1001, "Server shutting down");
    }

    this.connections.clear();
  }
}

export type RealtimeConnection = Connection;
