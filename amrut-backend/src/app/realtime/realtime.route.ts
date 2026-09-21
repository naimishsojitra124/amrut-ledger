import type { FastifyInstance } from "fastify";

import type { JwtSessionPayload } from "@/modules/auth/auth.types";

import type { RealtimeConnection } from "./realtime.hub.js";

const MAX_FRAME_BYTES = 4_096;

function parseClientFrame(raw: string): { type: string; [key: string]: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const frame = parsed as Record<string, unknown>;
    return typeof frame.type === "string" ? { ...frame, type: frame.type } : null;
  } catch {
    return null;
  }
}

function handleAuthFrame(
  app: FastifyInstance,
  connection: RealtimeConnection,
  frame: Record<string, unknown>,
): void {
  const token = typeof frame.token === "string" ? frame.token : "";
  const clientId = typeof frame.clientId === "string" ? frame.clientId.slice(0, 64) : null;

  if (!token) {
    app.realtime.reject(connection, "A token is required");
    return;
  }

  let payload: JwtSessionPayload;

  try {
    payload = app.jwt.verify<JwtSessionPayload>(token);
  } catch {
    app.realtime.reject(connection, "Your session has expired");
    return;
  }

  // A refresh token is not proof of an active session; only the access token is.
  if (payload.tokenType !== "access" || !payload.sub || !payload.role) {
    app.realtime.reject(connection, "Unauthorized");
    return;
  }

  // The role is kept on the connection so each pushed record can be checked against
  // what this subscriber is allowed to read.
  app.realtime.authenticate(connection, payload.sub, payload.role, clientId);
}

// Change signals only. Nothing here reads the database or returns a record, so a
// subscriber learns that something moved and then asks for it through the REST API,
// where its own permissions still apply.
export async function realtimeRoutes(app: FastifyInstance) {
  app.get("/realtime", { websocket: true }, (socket, request) => {
    const connection = app.realtime.accept(socket, request.ip);

    if (!connection) return;

    socket.on("pong", () => app.realtime.markAlive(connection));

    socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      app.realtime.markAlive(connection);

      const raw = Array.isArray(data)
        ? Buffer.concat(data).toString("utf8")
        : Buffer.from(data as Buffer).toString("utf8");

      if (raw.length > MAX_FRAME_BYTES) {
        app.realtime.reject(connection, "Frame too large");
        return;
      }

      const frame = parseClientFrame(raw);
      if (!frame) return;

      if (frame.type === "auth") {
        handleAuthFrame(app, connection, frame);
        return;
      }

      // Anything else is a keepalive from a client that cannot see protocol-level pings.
    });

    socket.on("close", () => app.realtime.drop(connection.id));

    socket.on("error", (error: Error) => {
      request.log.debug({ err: error }, "realtime socket error");
      app.realtime.drop(connection.id);
    });
  });
}
