import { Router } from "express";
import authMiddleware, { requireRole } from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  create,
  list,
  getById,
  update,
  setStatus,
} from "../controllers/laboratory.controller.js";

const router = Router();

router.use(authMiddleware, requireRole("SUPERADMIN"));

router.post("/", asyncHandler(create));
router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getById));
router.patch("/:id", asyncHandler(update));
router.patch("/:id/status", asyncHandler(setStatus));

export default router;
