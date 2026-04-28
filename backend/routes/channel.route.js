import express from "express";
import { getChannels, createChannel, joinChannel, updateChannel, deleteChannel, syncChannelPermissions, updateChannelOverwrites } from "../controllers/channel.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";
import { requirePremiumForChannel } from "../middleware/verifyPremium.js";

const router = express.Router();

router.get("/", verifyToken, verifyCommunityAccess, getChannels);
router.post("/", verifyToken, verifyCommunityAccess, createChannel);
router.patch("/:id", verifyToken, verifyCommunityAccess, updateChannel);
router.put("/:id/sync", verifyToken, verifyCommunityAccess, syncChannelPermissions);
router.put("/:id/overwrites", verifyToken, verifyCommunityAccess, updateChannelOverwrites);
router.delete("/:id", verifyToken, verifyCommunityAccess, deleteChannel);
router.post("/:id/join", verifyToken, verifyCommunityAccess, requirePremiumForChannel, joinChannel);

export default router;
