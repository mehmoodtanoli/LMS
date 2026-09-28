import { Router } from "express";
import { register, login, getMe } from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", authMiddleware, asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getMe));

export default router;
