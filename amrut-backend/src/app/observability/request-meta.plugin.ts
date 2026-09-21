import { randomUUID } from "node:crypto";

import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import type { IncomingMessage } from "node:http";

import {
  REQUEST_ID_HEADER,
  SERVER_TIMING_HEADER,
  SERVER_TIME_HEADER,
  SERVER_TIME_MS_HEADER,
} from "./request-meta.types.js";

// Anything a caller supplies ends up in headers and log lines, so it has to be boring.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

// Above this a request is worth a log line of its own; below it the noise is not worth it.
const SLOW_REQUEST_MS = 1_000;

const startedAt = new WeakMap<FastifyRequest, bigint>();

// Fastify fixes request.id at construction, so the caller's id has to be adopted here.
export function resolveRequestId(raw: IncomingMessage): string {
  const header = raw.headers[REQUEST_ID_HEADER];
  const value = Array.isArray(header) ? header[0] : header;

  return typeof value === "string" && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}

function elapsedMs(request: FastifyRequest): number {
  const start = startedAt.get(request);
  if (start === undefined) return 0;

  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

// Every response carries who handled it and how long the server itself took. Subtracting
// that from what the browser measured is what separates a slow query from a slow link.
export const requestMetaPlugin = fp(async (app) => {
  app.addHook("onRequest", async (request) => {
    startedAt.set(request, process.hrtime.bigint());
  });

  app.addHook("onSend", async (request, reply, payload) => {
    const durationMs = Math.round(elapsedMs(request) * 10) / 10;

    reply.header(REQUEST_ID_HEADER, request.id);
    reply.header(SERVER_TIME_MS_HEADER, String(durationMs));
    reply.header(SERVER_TIME_HEADER, new Date().toISOString());
    reply.header(SERVER_TIMING_HEADER, `app;dur=${durationMs}`);

    return payload;
  });

  app.addHook("onResponse", async (request, reply) => {
    const durationMs = elapsedMs(request);
    if (durationMs < SLOW_REQUEST_MS) return;

    request.log.warn(
      {
        requestId: request.id,
        method: request.method,
        path: request.routeOptions.url ?? request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationMs),
      },
      "slow request",
    );
  });
});
