import express from "express";
import {
	getEvents,
	createEvent,
	toggleRsvp,
	deleteEvent,
	startEvent,
	endEvent,
	updateEvent,
	getCalendarLinks,
	downloadEventIcs,
	setEventReminder,
} from "../controllers/event.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";

const router = express.Router();

router.get("/", verifyToken, verifyCommunityAccess, getEvents);
router.post("/", verifyToken, verifyCommunityAccess, createEvent);
router.post("/:id/rsvp", verifyToken, verifyCommunityAccess, toggleRsvp);
router.delete("/:id", verifyToken, verifyCommunityAccess, deleteEvent);
router.post("/:id/start", verifyToken, verifyCommunityAccess, startEvent);
router.post("/:id/end", verifyToken, verifyCommunityAccess, endEvent);
router.put("/:id", verifyToken, verifyCommunityAccess, updateEvent);
router.get("/:id/calendar-links", verifyToken, verifyCommunityAccess, getCalendarLinks);
router.get("/:id/calendar.ics", verifyToken, verifyCommunityAccess, downloadEventIcs);
router.post("/:id/reminder", verifyToken, verifyCommunityAccess, setEventReminder);

export default router;
