import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { JwtSessionPayload } from "@/modules/auth/auth.types";
import type { UserRole } from "../../../generated/prisma/enums";

import type {
  RealtimeAction,
  RealtimeActor,
  RealtimeChange,
  RealtimeResource,
} from "./realtime.types.js";

interface ChangeRule {
  resource: RealtimeResource;
  action: RealtimeAction;
  entityParam?: string;
  customerParam?: string;
}

// Keyed by method and the registered route pattern, so adding an endpoint without a rule
// simply broadcasts nothing rather than guessing at what it touched.
const CHANGE_RULES: Record<string, ChangeRule> = {
  "POST /customers": { resource: "customer", action: "created" },
  "PATCH /customers/:id": {
    resource: "customer",
    action: "updated",
    entityParam: "id",
    customerParam: "id",
  },
  "PATCH /customers/:id/archive": {
    resource: "customer",
    action: "updated",
    entityParam: "id",
    customerParam: "id",
  },
  "PATCH /customers/:id/restore": {
    resource: "customer",
    action: "updated",
    entityParam: "id",
    customerParam: "id",
  },
  "POST /customers/:id/deposits/top-up": {
    resource: "customer-deposit",
    action: "created",
    customerParam: "id",
  },
  "POST /customers/:id/deposits/refund": {
    resource: "customer-deposit",
    action: "created",
    customerParam: "id",
  },
  "POST /customers/:id/opening-balance": {
    resource: "opening-balance",
    action: "created",
    customerParam: "id",
  },
  "DELETE /customers/:id/opening-balance": {
    resource: "opening-balance",
    action: "deleted",
    customerParam: "id",
  },

  "POST /customers/:customerId/ledgers/today": {
    resource: "daily-ledger",
    action: "created",
    customerParam: "customerId",
  },
  "POST /customers/:customerId/ledgers/:date/entries": {
    resource: "daily-ledger",
    action: "created",
    customerParam: "customerId",
  },
  "PATCH /customers/:customerId/ledgers/:date/entries/:entryId": {
    resource: "daily-ledger",
    action: "updated",
    customerParam: "customerId",
    entityParam: "entryId",
  },
  "DELETE /customers/:customerId/ledgers/:date/entries/:entryId": {
    resource: "daily-ledger",
    action: "deleted",
    customerParam: "customerId",
    entityParam: "entryId",
  },
  "PATCH /customers/:customerId/ledgers/:date/no-purchase": {
    resource: "daily-ledger",
    action: "updated",
    customerParam: "customerId",
  },

  "POST /customers/:customerId/bills": {
    resource: "bill",
    action: "created",
    customerParam: "customerId",
  },
  "POST /payments": { resource: "payment", action: "created" },
  "POST /payments/:paymentId/reverse": {
    resource: "payment",
    action: "updated",
    entityParam: "paymentId",
  },

  "POST /cards": { resource: "card", action: "created" },
  "PATCH /cards/:id": { resource: "card", action: "updated", entityParam: "id" },
  "POST /cards/:id/assign": { resource: "card", action: "updated", entityParam: "id" },
  "PATCH /cards/:id/make-available": {
    resource: "card",
    action: "updated",
    entityParam: "id",
  },

  "POST /function-orders": { resource: "function-order", action: "created" },
  "PATCH /function-orders/:id": {
    resource: "function-order",
    action: "updated",
    entityParam: "id",
  },
  "DELETE /function-orders/:id": {
    resource: "function-order",
    action: "deleted",
    entityParam: "id",
  },

  "POST /milk-types": { resource: "milk-type", action: "created" },
  "PATCH /milk-types/:id": { resource: "milk-type", action: "updated", entityParam: "id" },
  "PATCH /milk-types/:id/archive": {
    resource: "milk-type",
    action: "updated",
    entityParam: "id",
  },
  "PATCH /milk-types/:id/restore": {
    resource: "milk-type",
    action: "updated",
    entityParam: "id",
  },

  "POST /product-suggestions": { resource: "product-suggestion", action: "created" },
  "PATCH /product-suggestions/reorder": {
    resource: "product-suggestion",
    action: "updated",
  },
  "PATCH /product-suggestions/:id": {
    resource: "product-suggestion",
    action: "updated",
    entityParam: "id",
  },
  "PATCH /product-suggestions/:id/archive": {
    resource: "product-suggestion",
    action: "updated",
    entityParam: "id",
  },
  "PATCH /product-suggestions/:id/restore": {
    resource: "product-suggestion",
    action: "updated",
    entityParam: "id",
  },

  "POST /users": { resource: "user", action: "created" },
  "PATCH /users/:id": { resource: "user", action: "updated", entityParam: "id" },
  "PATCH /users/:id/password": { resource: "user", action: "updated", entityParam: "id" },
  "PATCH /users/:id/role": { resource: "user", action: "updated", entityParam: "id" },
  "PATCH /users/:id/archive": { resource: "user", action: "updated", entityParam: "id" },
  "PATCH /users/:id/restore": { resource: "user", action: "updated", entityParam: "id" },

  "POST /system/jobs/:id/retry": {
    resource: "system-job",
    action: "updated",
    entityParam: "id",
  },
};

// Parsing a reply back out only pays off while it is small enough to be worth pushing.
const MAX_CAPTURED_BODY_CHARS = 64 * 1024;

const NAME_CACHE_TTL_MS = 5 * 60_000;

const capturedBody = new WeakMap<FastifyRequest, string>();

function findChangeRule(method: string, routeUrl: string | undefined): ChangeRule | null {
  if (!routeUrl) return null;
  return CHANGE_RULES[`${method} ${routeUrl}`] ?? null;
}

function readParam(params: unknown, name: string | undefined): string | undefined {
  if (!name || !params || typeof params !== "object") return undefined;

  const value = (params as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildChange(rule: ChangeRule, params: unknown): RealtimeChange {
  return {
    resource: rule.resource,
    action: rule.action,
    entityId: readParam(params, rule.entityParam),
    customerId: readParam(params, rule.customerParam),
  };
}

function readClientId(request: FastifyRequest): string | null {
  const header = request.headers["x-client-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === "string" && value.length > 0 ? value.slice(0, 64) : null;
}

// One lookup per user per five minutes, so naming who made the change costs no extra
// round trip on the request being broadcast.
const nameCache = new Map<string, { fullName: string | null; at: number }>();

async function resolveFullName(app: FastifyInstance, userId: string): Promise<string | null> {
  const cached = nameCache.get(userId);
  if (cached && Date.now() - cached.at < NAME_CACHE_TTL_MS) return cached.fullName;

  try {
    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const fullName = user?.fullName ?? null;
    nameCache.set(userId, { fullName, at: Date.now() });

    return fullName;
  } catch {
    return cached?.fullName ?? null;
  }
}

// Instance hooks run before a route's own preHandler, so request.user is not populated
// at "started" time and the token has to be read directly.
function readTokenActor(
  app: FastifyInstance,
  request: FastifyRequest,
): { id: string; role: UserRole } | null {
  const fromRoute = request.user as { sub?: string; role?: UserRole } | undefined;
  if (fromRoute?.sub && fromRoute.role) return { id: fromRoute.sub, role: fromRoute.role };

  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;

  try {
    const payload = app.jwt.verify<JwtSessionPayload>(header.slice(7));
    if (payload.tokenType !== "access" || !payload.sub || !payload.role) return null;

    return { id: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

async function buildActor(
  app: FastifyInstance,
  request: FastifyRequest,
): Promise<RealtimeActor | null> {
  const actor = readTokenActor(app, request);
  if (!actor) return null;

  return { id: actor.id, role: actor.role, fullName: await resolveFullName(app, actor.id) };
}

function takeParsedBody(request: FastifyRequest): unknown {
  const raw = capturedBody.get(request);
  capturedBody.delete(request);

  if (raw === undefined) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }

  return "The change could not be saved.";
}

// Broadcasting from one place rather than from every handler means a write cannot be
// added later that quietly forgets to tell the other tablets about itself.
export function registerChangeBroadcast(app: FastifyInstance): void {
  app.addHook("preHandler", async (request) => {
    const rule = findChangeRule(request.method, request.routeOptions.url);
    if (!rule) return;

    app.realtime.publish({
      ...buildChange(rule, request.params),
      phase: "started",
      requestId: String(request.id),
      method: request.method,
      url: request.url,
      route: request.routeOptions.url ?? request.url,
      actor: await buildActor(app, request),
      originClientId: readClientId(request),
    });
  });

  // The serialised reply is only available here, and it is the record every other
  // device needs in order to update itself without asking for it again.
  app.addHook("onSend", async (request, _reply, payload) => {
    if (typeof payload !== "string" || payload.length > MAX_CAPTURED_BODY_CHARS) return payload;
    if (!findChangeRule(request.method, request.routeOptions.url)) return payload;

    capturedBody.set(request, payload);

    return payload;
  });

  // After the reply has gone out, so a subscriber never delays the caller.
  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const rule = findChangeRule(request.method, request.routeOptions.url);
    if (!rule) return;

    const body = takeParsedBody(request);
    const failed = reply.statusCode >= 400;

    app.realtime.publish({
      ...buildChange(rule, request.params),
      phase: failed ? "error" : "success",
      requestId: String(request.id),
      method: request.method,
      url: request.url,
      route: request.routeOptions.url ?? request.url,
      status: reply.statusCode,
      actor: await buildActor(app, request),
      originClientId: readClientId(request),
      ...(failed ? { error: { message: errorMessage(body) } } : { data: body }),
    });
  });
}
