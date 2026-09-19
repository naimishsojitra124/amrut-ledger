import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

/**
 * Every failure leaves here with a `message` the UI can show verbatim.
 *
 * The frontend surfaces `message` in a toast, so an unmapped error used to
 * reach the user as a bare "Internal Server Error" (or as nothing at all).
 * Anything we can explain — validation, duplicates, bad ids, rate limits — is
 * translated here; genuinely unexpected errors are logged in full and reported
 * generically so we never leak internals.
 */

interface PrismaLikeError {
  code?: string;
  meta?: { target?: unknown; cause?: unknown; modelName?: unknown };
  name?: string;
}

function fieldLabel(target: unknown): string | null {
  const fields = Array.isArray(target)
    ? target.filter((item): item is string => typeof item === "string")
    : typeof target === "string"
      ? [target]
      : [];

  if (fields.length === 0) return null;

  const readable: Record<string, string> = {
    mobileNumber: "mobile number",
    email: "email address",
    cardNumber: "card number",
    shortCode: "short code",
    billNumber: "bill number",
    receiptNumber: "receipt number",
    clientRequestId: "request",
    sessionId: "session",
  };

  return fields.map((field) => readable[field] ?? field).join(" and ");
}

/** Maps Prisma's error codes onto messages and status codes a user can act on. */
function mapPrismaError(error: PrismaLikeError): { statusCode: number; message: string } | null {
  switch (error.code) {
    case "P2002": {
      const label = fieldLabel(error.meta?.target);
      return {
        statusCode: 409,
        message: label
          ? `That ${label} is already in use.`
          : "A record with these details already exists.",
      };
    }
    case "P2025":
      return { statusCode: 404, message: "The requested record no longer exists." };
    case "P2003":
      return {
        statusCode: 409,
        message: "This record is still referenced elsewhere and cannot be changed.",
      };
    case "P2000":
      return { statusCode: 400, message: "One of the values provided is too long." };
    case "P2023":
      // Malformed ObjectId — almost always a bad id in the URL.
      return { statusCode: 400, message: "That identifier is not valid." };
    case "P2034":
      return {
        statusCode: 409,
        message: "Someone else changed this record at the same time. Please try again.",
      };
    default:
      break;
  }

  if (error.name === "PrismaClientValidationError") {
    return { statusCode: 400, message: "The request contained invalid or missing fields." };
  }

  return null;
}

/** "Mobile number must be a 10 digit number" rather than a raw issue array. */
function formatZodError(error: ZodError): string {
  const first = error.issues[0];
  if (!first) return "Validation failed";

  const path = first.path.filter((part) => typeof part === "string").join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

export function setGlobalErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) =>
    reply.status(404).send({
      message: `No route matches ${request.method} ${request.url}`,
    }),
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.info({ issues: error.issues }, "request validation failed");
      return reply.status(400).send({
        message: formatZodError(error),
        issues: error.issues,
      });
    }

    const prismaMapped = mapPrismaError(error as unknown as PrismaLikeError);

    if (prismaMapped) {
      request.log.warn({ err: error }, "database constraint rejected the request");
      return reply.status(prismaMapped.statusCode).send({ message: prismaMapped.message });
    }

    if ((error as { code?: string }).code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER") {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const typedError = error as { statusCode?: number; message?: string };

    if (typedError.statusCode && typedError.statusCode < 500) {
      // Fastify's own errors (validation, rate limit, payload size) and the
      // deliberate `createHttpError` throws from our services.
      request.log.info({ err: error }, "request rejected");
      return reply.status(typedError.statusCode).send({
        message: typedError.message ?? "Request could not be completed",
      });
    }

    request.log.error({ err: error }, "unhandled error");

    return reply.status(typedError.statusCode ?? 500).send({
      message: "Something went wrong on our side. Please try again.",
    });
  });
}
