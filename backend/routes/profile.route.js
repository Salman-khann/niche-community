import express from "express";
import { getLeaderboard, getProfile, updateProfile } from "../controllers/profile.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/leaderboard", verifyToken, getLeaderboard);
router.get("/:id", verifyToken, getProfile);
router.put("/:id", verifyToken, updateProfile);

export default router;
