// Mirrored by the frontend in src/services/utils/response-meta.ts. Both sides read the
// same header names, so renaming one here means renaming it there.
export const REQUEST_ID_HEADER = "x-request-id";
export const SERVER_TIME_MS_HEADER = "x-server-time-ms";
export const SERVER_TIME_HEADER = "x-server-time";
export const SERVER_TIMING_HEADER = "server-timing";

export const RESPONSE_META_HEADERS = [
  REQUEST_ID_HEADER,
  SERVER_TIME_MS_HEADER,
  SERVER_TIME_HEADER,
  SERVER_TIMING_HEADER,
] as const;

export interface ResponseMeta {
  // Echoed back from the caller when it sent one, so one id spans browser and server logs.
  requestId: string;
  // Time inside the server process: the rest of the wall clock is network.
  serverTimeMs: number;
  serverTime: string;
}
