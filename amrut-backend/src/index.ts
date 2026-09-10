import "dotenv/config";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const start = async () => {
  const app = await buildApp();

  const port = Number(env.port);
  const host = env.host;

  await app.listen({ port, host });
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});