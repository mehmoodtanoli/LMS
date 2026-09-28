import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { create, list, getById } from "../controllers/report.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", asyncHandler(create));
router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getById));

export default router;