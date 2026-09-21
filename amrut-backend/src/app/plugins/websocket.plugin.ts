import fp from "fastify-plugin";

import { RealtimeHub } from "@/app/realtime/realtime.hub";
import { registerChangeBroadcast } from "@/app/realtime/realtime.publisher";
import { realtimeRoutes } from "@/app/realtime/realtime.route";

export const websocketPlugin = fp(async (app) => {
  await app.register(import("@fastify/websocket"), {
    options: { maxPayload: 8 * 1024 },
  });

  const hub = new RealtimeHub(app.log);
  app.decorate("realtime", hub);

  app.addHook("onClose", async () => {
    await hub.close();
  });

  await app.register(realtimeRoutes);
  registerChangeBroadcast(app);
});
