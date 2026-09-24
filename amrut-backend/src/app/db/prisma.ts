import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client";

// `app.prisma` is declared against the `@prisma/client` stub, which is a looser type than
// the client actually generated into `generated/prisma`. Reading it through here keeps the
// generated row types, so a `findMany` result is still checked against what it is mapped to.
export function getPrisma(app: FastifyInstance) {
  return (app as FastifyInstance & { prisma: PrismaClient }).prisma;
}
