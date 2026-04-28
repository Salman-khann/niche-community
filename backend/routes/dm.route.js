import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getThread, getThreads, getThreadInfo, createGroupThread, addParticipants, getMessages, sendMessage, editMessage, leaveThread, deleteDmMessage } from "../controllers/dm.controller.js";

const router = express.Router();

router.get("/thread/:userId", verifyToken, getThread);
router.get("/threads", verifyToken, getThreads);
router.get("/thread-info/:threadId", verifyToken, getThreadInfo);
router.post("/group", verifyToken, createGroupThread);
router.post("/thread/:threadId/add", verifyToken, addParticipants);
router.post("/thread/:threadId/leave", verifyToken, leaveThread);
router.get("/messages/:threadId", verifyToken, getMessages);
router.post("/messages/:threadId", verifyToken, sendMessage);
router.put("/messages/:threadId/:messageId", verifyToken, editMessage);
router.delete("/messages/:threadId/:messageId", verifyToken, deleteDmMessage);

export default router;
