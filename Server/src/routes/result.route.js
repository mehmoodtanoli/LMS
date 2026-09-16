import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { create, list, getById, update } from "../controllers/result.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", asyncHandler(create));
router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getById));
router.patch("/:id", asyncHandler(update));

export default router;