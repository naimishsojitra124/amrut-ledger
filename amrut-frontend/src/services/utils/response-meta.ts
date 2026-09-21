// Header names are shared with the backend in src/app/observability/request-meta.types.ts.
// They only reach this code because the API lists them in Access-Control-Expose-Headers.
export const REQUEST_ID_HEADER = "x-request-id";
export const SERVER_TIME_MS_HEADER = "x-server-time-ms";
export const SERVER_TIME_HEADER = "x-server-time";
export const CLIENT_ID_HEADER = "x-client-id";

export interface ResponseMeta {
  requestId: string | null;
  // Time spent inside the API process.
  serverMs: number | null;
  serverTime: string | null;
  // Measured in the browser, so it includes the trip out and back.
  totalMs: number;
  // Whatever the server did not account for: the network, the proxy and the queue.
  networkMs: number | null;
}

type HeaderBag = { get?: (name: string) => unknown } | Record<string, unknown> | undefined;

function readHeader(headers: HeaderBag, name: string): string | null {
  if (!headers) return null;

  const bag = headers as { get?: (key: string) => unknown };
  const raw =
    typeof bag.get === "function"
      ? bag.get(name)
      : (headers as Record<string, unknown>)[name];

  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "number") return String(raw);

  return null;
}

export function readResponseMeta(headers: HeaderBag, totalMs: number): ResponseMeta {
  const rawServerMs = readHeader(headers, SERVER_TIME_MS_HEADER);
  const serverMs = rawServerMs === null ? null : Number(rawServerMs);
  const usableServerMs = serverMs !== null && Number.isFinite(serverMs) ? serverMs : null;

  return {
    requestId: readHeader(headers, REQUEST_ID_HEADER),
    serverMs: usableServerMs,
    serverTime: readHeader(headers, SERVER_TIME_HEADER),
    totalMs,
    networkMs: usableServerMs === null ? null : Math.max(0, totalMs - usableServerMs),
  };
}

export function describeResponseMeta(meta: ResponseMeta): string {
  if (meta.serverMs === null) return `${Math.round(meta.totalMs)}ms`;

  return `${Math.round(meta.totalMs)}ms (server ${Math.round(meta.serverMs)}ms, network ${Math.round(meta.networkMs ?? 0)}ms)`;
}
