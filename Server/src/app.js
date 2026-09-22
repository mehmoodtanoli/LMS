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
import userRouter from "./routes/user.route.js";
import dashboardRouter from "./routes/dashboard.route.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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

app.use("/api/auth", authRouter);
app.use("/api/patients", patientRouter);
app.use("/api/tests", testRouter);
app.use("/api/test-orders", testOrderRouter);
app.use("/api/results", resultRouter);
app.use("/api/reports", reportRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin/laboratories", laboratoryRouter);
app.use("/api/admin/users", userRouter);
app.use("/api/admin/dashboard", dashboardRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
