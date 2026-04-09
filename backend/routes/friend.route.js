import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { listFriends, listRequests, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers } from "../controllers/friend.controller.js";

const router = express.Router();

router.get("/", verifyToken, listFriends);
router.get("/requests", verifyToken, listRequests);
router.get("/search", verifyToken, searchUsers);
router.post("/request", verifyToken, sendRequest);
router.post("/accept", verifyToken, acceptRequest);
router.post("/decline", verifyToken, declineRequest);
router.post("/remove", verifyToken, removeFriend);

export default router;
