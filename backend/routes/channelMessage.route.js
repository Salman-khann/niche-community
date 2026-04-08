import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";
import { requirePremiumForChannel } from "../middleware/verifyPremium.js";
import { getChannelMessages, createChannelMessage, reactToChannelMessage, getChannelMessageComments, addChannelMessageComment, reactToChannelMessageComment, togglePin, getPinnedMessages } from "../controllers/channelMessage.controller.js";

const router = express.Router();

router.get("/:channelId", verifyToken, verifyCommunityAccess, requirePremiumForChannel, getChannelMessages);
router.post("/:channelId", verifyToken, verifyCommunityAccess, requirePremiumForChannel, createChannelMessage);
router.post("/:channelId/:messageId/react", verifyToken, verifyCommunityAccess, requirePremiumForChannel, reactToChannelMessage);
router.get("/:channelId/:messageId/comments", verifyToken, verifyCommunityAccess, requirePremiumForChannel, getChannelMessageComments);
router.post("/:channelId/:messageId/comments", verifyToken, verifyCommunityAccess, requirePremiumForChannel, addChannelMessageComment);
router.post("/:channelId/:messageId/comments/:commentId/react", verifyToken, verifyCommunityAccess, requirePremiumForChannel, reactToChannelMessageComment);
router.post("/:channelId/:messageId/pin", verifyToken, verifyCommunityAccess, requirePremiumForChannel, togglePin);
router.get("/:channelId/pins", verifyToken, verifyCommunityAccess, requirePremiumForChannel, getPinnedMessages);

export default router;
