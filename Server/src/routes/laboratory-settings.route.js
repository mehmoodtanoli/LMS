import { Router } from "express";
import authMiddleware, { requireRole } from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  getProfile,
  updateProfile,
} from "../controllers/laboratory.controller.js";

const router = Router();

router.use(authMiddleware, requireRole("LAB_ADMIN"));
router.get("/", asyncHandler(getProfile));
router.patch("/", asyncHandler(updateProfile));

export default router;
