import "@fastify/jwt";
import type { AuthUserPayload } from "@/modules/auth/auth.types";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}