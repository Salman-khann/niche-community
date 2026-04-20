import express from "express";
import { createCommunity, generateInvite, getInviteCodes, getMyCommunity, getMyCommunities, getAllCommunities, createInviteRequest, getInviteRequests, approveInviteRequest, rejectInviteRequest, getMembers, updateMemberRole, searchMembers, joinCommunity, getRoster, getCommunityProfile, updateCommunityProfile, deleteCommunity, kickMember, getRoles, createRole, updateRole, deleteRole, updateMemberRoles, updateNotificationSettings } from "../controllers/community.controller.js";
import { sendServerInvite } from "../controllers/serverInvite.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCommunityAccess } from "../middleware/verifyCommunityAccess.js";

const router = express.Router();

// Get the authenticated user's own community (must be before /:id routes)
router.get("/mine", verifyToken, getMyCommunity);

// Get all communities owned by the authenticated user
router.get("/mine-all", verifyToken, getMyCommunities);

// Get all communities (directory)
router.get("/all", verifyToken, getAllCommunities);

// Invite requests (directory)
router.post("/:id/invite-requests", verifyToken, createInviteRequest);
router.get("/:id/invite-requests", verifyToken, verifyCommunityAccess, getInviteRequests);
router.post("/:id/invite-requests/:requestId/approve", verifyToken, verifyCommunityAccess, approveInviteRequest);
router.post("/:id/invite-requests/:requestId/reject", verifyToken, verifyCommunityAccess, rejectInviteRequest);

// Roster for the active community (any member)
router.get("/roster", verifyToken, verifyCommunityAccess, getRoster);

// Create a new community (auth required)
router.post("/", verifyToken, createCommunity);

// Join a community with invite code (auth required)
router.post("/join", verifyToken, joinCommunity);

// Generate invite code + optionally email it (admin only)
router.post("/:id/invites", verifyToken, verifyCommunityAccess, generateInvite);
// Direct invite to an existing user (admin only)
router.post("/:id/invites/direct", verifyToken, verifyCommunityAccess, sendServerInvite);

// Get all invite codes for a community (admin only)
router.get("/:id/invites", verifyToken, getInviteCodes);

// Server profile (admin read/update via settings)
router.get("/:id/profile", verifyToken, verifyCommunityAccess, getCommunityProfile);
router.put("/:id/profile", verifyToken, verifyCommunityAccess, updateCommunityProfile);
router.delete("/:id", verifyToken, verifyCommunityAccess, deleteCommunity);

// Search members by name for @mention autocomplete (any authenticated member)
router.get("/:id/members/search", verifyToken, searchMembers);

// Get all members of a community (admin/mod only)
router.get("/:id/members", verifyToken, verifyCommunityAccess, getMembers);

// Update a member's community role (admin only)
router.put("/:id/members/:userId/role", verifyToken, verifyCommunityAccess, updateMemberRole);
// Update a member's role list (admin/mod)
router.put("/:id/members/:userId/roles", verifyToken, verifyCommunityAccess, updateMemberRoles);
// Kick a member (admin only)
router.delete("/:id/members/:userId", verifyToken, verifyCommunityAccess, kickMember);

// Roles
router.get("/:id/roles", verifyToken, verifyCommunityAccess, getRoles);
router.post("/:id/roles", verifyToken, verifyCommunityAccess, createRole);
router.put("/:id/roles/:roleId", verifyToken, verifyCommunityAccess, updateRole);
router.delete("/:id/roles/:roleId", verifyToken, verifyCommunityAccess, deleteRole);

router.put("/:id/notifications", verifyToken, verifyCommunityAccess, updateNotificationSettings);

export default router;
