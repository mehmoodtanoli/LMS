import { Router } from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  create,
  list,
  getById,
  update,
  remove,
} from "../controllers/test-order.controller.js";

const router = Router();

router.use(authMiddleware);

router.post("/", asyncHandler(create));
router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getById));
router.patch("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

export default router;