import app from "./app.js";
import env from "./config/env.js";
import prisma from "./config/prisma.js";
import logger from "./utils/logger.js";

let server;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info("Database connection established successfully.");

    server = app.listen(env.port, () => {
      logger.info(
        `LMS API server started successfully on port ${env.port} (${env.nodeEnv} environment)`
      );
    });
  } catch (error) {
    logger.error("Server startup failed:", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info("HTTP server closed.");
      await prisma.$disconnect();
      logger.info("Database disconnected.");
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

startServer();
