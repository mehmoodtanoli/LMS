import { Router } from "express";
import authMiddleware, { requireRole } from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getSummary } from "../controllers/dashboard.controller.js";

const router = Router();

router.use(authMiddleware, requireRole("SUPERADMIN"));

router.get("/", asyncHandler(getSummary));

export default router;
