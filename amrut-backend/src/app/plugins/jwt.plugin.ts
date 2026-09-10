import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { env } from "@/config/env";

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  await app.register(cookie);

  await app.register(jwt, {
    secret: env.jwtAccessSecret,
  });
});