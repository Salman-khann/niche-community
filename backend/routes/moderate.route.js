import express from "express";
import {
    flagPost,
    unbanUser,
    reportMessage,
    getModerationQueue,
    resolveFlag,
    resolveMessageFlag,
    deletePost,
    deleteMessage,
    warnUser,
    suspendUser,
    banUser,
    addBlocklistEntry,
    getBlocklist,
    removeBlocklistEntry,
    getAuditLogs,
} from "../controllers/moderate.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";

const router = express.Router();

// Flag a post (any authenticated community member)
router.post("/flag", verifyToken, verifyCommunityAccess, flagPost);
// Report a channel message (any authenticated community member)
router.post("/message/report", verifyToken, verifyCommunityAccess, reportMessage);

// Review queue (admin / mod)
router.get("/queue", verifyToken, verifyCommunityAccess, getModerationQueue);

// Dismiss flag (admin / mod)
router.post("/resolve/:id", verifyToken, verifyCommunityAccess, resolveFlag);
// Dismiss message flag (admin / mod)
router.post("/resolve-message/:id", verifyToken, verifyCommunityAccess, resolveMessageFlag);

// Delete post (admin / mod)
router.delete("/post/:id", verifyToken, verifyCommunityAccess, deletePost);
// Delete message (admin / mod)
router.delete("/message/:id", verifyToken, verifyCommunityAccess, deleteMessage);

// Warn user (admin / mod)
router.post("/warn/:userId", verifyToken, verifyCommunityAccess, warnUser);

// Suspend user for a duration (admin / mod)
router.post("/suspend/:userId", verifyToken, verifyCommunityAccess, suspendUser);

// Ban user from community (admin only)
router.post("/ban/:userId", verifyToken, verifyCommunityAccess, banUser);

// Unban user (admin only)
router.post("/unban/:userId", verifyToken, verifyCommunityAccess, unbanUser);

// Blocklist (admin / mod)
router.post("/blocklist", verifyToken, verifyCommunityAccess, addBlocklistEntry);
router.get("/blocklist", verifyToken, verifyCommunityAccess, getBlocklist);
router.delete("/blocklist", verifyToken, verifyCommunityAccess, removeBlocklistEntry);

// Audit log (admin / mod)
router.get("/logs", verifyToken, verifyCommunityAccess, getAuditLogs);

export default router;
