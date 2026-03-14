/**
 * API server entry point.
 * Builds the Fastify app, registers plugins and routes, then starts listening.
 */

import Fastify from "fastify";
import { registerPlugins } from "./plugins";
import { registerRoutes } from "./routes";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const HOST = process.env["HOST"] ?? "0.0.0.0";

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
      // Structured JSON logging in production
      ...(process.env["NODE_ENV"] === "production" && {
        transport: undefined,
      }),
    },
    // Expose raw body for HMAC webhook verification
    addContentTypeParser: undefined,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: "x-request-id",
  });

  // Register plugins (auth, cors, rate-limiting)
  await registerPlugins(app);

  // Register all route modules
  await registerRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();

  // Graceful shutdown — close the *running* app instance, not a newly built one
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received — shutting down gracefully`);
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error(err, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API server running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
