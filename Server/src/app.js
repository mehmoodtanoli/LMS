import express from "express";
import cors from "cors";
import morgan from "morgan";
import logger from "./utils/logger.js";
import ApiResponse from "./utils/ApiResponse.js";
import notFoundMiddleware from "./middlewares/notFound.middleware.js";
import errorHandlerMiddleware from "./middlewares/errorHandler.middleware.js";
import authRouter from "./routes/auth.route.js";
import patientRouter from "./routes/patient.route.js";
import testRouter from "./routes/test.route.js";
import testOrderRouter from "./routes/test-order.route.js";
import resultRouter from "./routes/result.route.js";
import reportRouter from "./routes/report.route.js";
import paymentRouter from "./routes/payment.route.js";
import laboratoryRouter from "./routes/laboratory.route.js";
import laboratorySettingsRouter from "./routes/laboratory-settings.route.js";
import userRouter from "./routes/user.route.js";
import dashboardRouter from "./routes/dashboard.route.js";
import supportRouter from "./routes/support.route.js";
import prisma from "./config/prisma.js";

const app = express();

// Trust proxy for proper IP resolution behind reverse proxy / load balancer (Fixes #8)
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

// Basic security headers middleware (Fixes S2)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

const morganStream = {
  write: (message) => logger.info(message.trim()),
};
app.use(morgan("combined", { stream: morganStream }));

app.get("/api/health", (req, res) => {
  const response = new ApiResponse(200, "LMS API is running.", {
    status: "ok",
  });
  res.status(200).json(response);
});

app.get("/api/ready", async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json(new ApiResponse(200, "LMS API is ready.", { status: "ready" }));
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/patients", patientRouter);
app.use("/api/tests", testRouter);
app.use("/api/test-orders", testOrderRouter);
app.use("/api/results", resultRouter);
app.use("/api/reports", reportRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin/laboratories", laboratoryRouter);
app.use("/api/laboratory-settings", laboratorySettingsRouter);
app.use("/api/admin/users", userRouter);
app.use("/api/admin/dashboard", dashboardRouter);
app.use("/api/support", supportRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
