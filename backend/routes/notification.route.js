import express from "express";
import {
	getNotifications,
	markAsRead,
	markAllAsRead,
	getNotificationPrefs,
	updateNotificationPrefs,
} from "../controllers/notification.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.get("/prefs", verifyToken, getNotificationPrefs);
router.put("/prefs", verifyToken, updateNotificationPrefs);
router.put("/read-all", verifyToken, markAllAsRead);
router.put("/:id/read", verifyToken, markAsRead);

export default router;
