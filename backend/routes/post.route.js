import express from "express";
import {
  getFeed,
  createPost,
  addComment,
  getComments,
  reactToPost,
  voteOnPoll,
  markReplyHelpful,
  toggleSavePost,
  getSavedPosts,
  reactToComment,
  togglePinPost,
  toggleFeaturePost,
  getTrendingHashtags,
} from "../controllers/post.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";
import { requirePremiumForChannel } from "../middleware/verifyPremium.js";

const router = express.Router();

router.get("/feed", verifyToken, verifyCommunityAccess, requirePremiumForChannel, getFeed);
router.get("/hashtags/trending", verifyToken, verifyCommunityAccess, requirePremiumForChannel, getTrendingHashtags);
router.get("/saved", verifyToken, getSavedPosts);
router.post("/", verifyToken, verifyCommunityAccess, requirePremiumForChannel, createPost);
router.post("/:id/reply", verifyToken, addComment);
router.get("/:id/comments", verifyToken, getComments);
router.post("/:postId/replies/:replyId/react", verifyToken, reactToComment);
router.post("/:id/react", verifyToken, reactToPost);
router.post("/:id/vote", verifyToken, voteOnPoll);
router.post("/:id/save", verifyToken, toggleSavePost);
router.post("/:id/pin", verifyToken, verifyCommunityAccess, requirePremiumForChannel, togglePinPost);
router.post("/:id/feature", verifyToken, verifyCommunityAccess, requirePremiumForChannel, toggleFeaturePost);
router.post("/:postId/replies/:replyId/helpful", verifyToken, markReplyHelpful);

export default router;
