import { Router } from "express";
import authMiddleware, { requireRole } from "../middlewares/auth.middleware.js";
import exportRateLimiter from "../middlewares/exportRateLimiter.middleware.js";
import {
  downloadComplete,
  downloadDataset,
  getDatasets,
  getHistory,
} from "../controllers/export.controller.js";

const router = Router();

// LAB_ADMIN only. SUPERADMIN and LAB_TECH receive 403.
router.use(authMiddleware, requireRole("LAB_ADMIN"));

router.get("/datasets", getDatasets);
router.get("/history", getHistory);
router.get("/complete", exportRateLimiter, downloadComplete);
// Keep this last so it does not swallow the fixed paths above.
router.get("/:dataset", exportRateLimiter, downloadDataset);

export default router;