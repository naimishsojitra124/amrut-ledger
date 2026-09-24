// The global error handler replies with `statusCode` whenever it is below 500, so a
// deliberate rejection has to carry one or it is reported as an internal failure.
export function createHttpError(statusCode: number, message: string) {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}
