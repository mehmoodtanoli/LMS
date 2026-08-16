import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import logger from "./utils/logger.js";

async function startServer() {
  try {
    await connectDB();

    app.listen(env.port, () => {
      logger.info(
        `LMS API server started successfully on port ${env.port} (${env.nodeEnv} environment)`,
      );
    });
  } catch (error) {
    logger.error("Server startup failed. The application will now exit.");
    process.exit(1);
  }
}

startServer();
