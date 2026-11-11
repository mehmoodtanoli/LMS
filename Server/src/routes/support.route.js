import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import { supportRateLimiter } from "../middlewares/rateLimiter.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getConfig, create } from "../controllers/support.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/config", asyncHandler(getConfig));
router.post("/", supportRateLimiter, asyncHandler(create));

export default router;
