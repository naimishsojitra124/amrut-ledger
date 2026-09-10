import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export function setGlobalErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Validation failed",
        issues: error.issues,
      });
    }

    if ((error as { code?: string }).code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER") {
      return reply.status(401).send({ message: "Unauthorized" });
    }

    const typedError = error as { statusCode?: number; message?: string };

    if (typedError.statusCode) {
      return reply.status(typedError.statusCode).send({
        message: typedError.message ?? "Error",
      });
    }

    return reply.status(500).send({
      message: "Internal Server Error",
    });
  });
}