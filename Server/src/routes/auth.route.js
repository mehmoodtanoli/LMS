import { Router } from "express";
import {
  register,
  login,
  getMe,
  changePassword,
} from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { loginRateLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.post("/register", authMiddleware, asyncHandler(register));
router.post("/login", loginRateLimiter, asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getMe));
router.post("/change-password", authMiddleware, asyncHandler(changePassword));

export default router;
