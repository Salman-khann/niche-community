import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";
import mongoose from "mongoose";

// ── Search across Posts & Profiles ──────────────────────────────────────────
export const search = async (req, res) => {
    try {
        const q = (req.query.q || "").trim();
        const limit = Math.min(25, Math.max(5, parseInt(req.query.limit, 10) || 10));
        const beforePosts = req.query.beforePosts ? String(req.query.beforePosts) : null;
        const beforeUsers = req.query.beforeUsers ? String(req.query.beforeUsers) : null;

        if (q.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Search query must be at least 2 characters",
            });
        }

        // Escape regex special chars for safety
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "i");

        const postFilter = { content: regex, communityId: req.communityId };
        if (beforePosts) {
            if (!mongoose.Types.ObjectId.isValid(beforePosts)) {
                return res.status(400).json({ success: false, message: "Invalid posts cursor" });
            }
            postFilter._id = { $lt: beforePosts };
        }

        const userFilter = { name: regex };
        if (beforeUsers) {
            if (!mongoose.Types.ObjectId.isValid(beforeUsers)) {
                return res.status(400).json({ success: false, message: "Invalid users cursor" });
            }
            userFilter._id = { $lt: beforeUsers };
        }

        // Run both searches in parallel
        const [postRows, userRows] = await Promise.all([
            // Posts matching content
            Post.find(postFilter)
                .sort({ _id: -1 })
                .limit(limit + 1)
                .populate("authorId", "name email")
                .lean(),

            // Users matching name
            User.find(userFilter)
                .sort({ _id: -1 })
                .select("name email")
                .limit(limit + 1)
                .lean(),
        ]);

        const postsHasMore = postRows.length > limit;
        const usersHasMore = userRows.length > limit;
        const posts = postsHasMore ? postRows.slice(0, limit) : postRows;
        const users = usersHasMore ? userRows.slice(0, limit) : userRows;
        const nextBeforePosts = postsHasMore && posts.length > 0
            ? posts[posts.length - 1]._id?.toString?.() || String(posts[posts.length - 1]._id)
            : null;
        const nextBeforeUsers = usersHasMore && users.length > 0
            ? users[users.length - 1]._id?.toString?.() || String(users[users.length - 1]._id)
            : null;

        // Enrich posts with author avatar
        const postAuthorIds = [...new Set(posts.map((p) => p.authorId._id.toString()))];
        const postProfiles = await Profile.find({ userId: { $in: postAuthorIds } }).lean();
        const postProfileMap = {};
        postProfiles.forEach((p) => { postProfileMap[p.userId.toString()] = p; });

        const enrichedPosts = posts.map((post) => ({
            _id: post._id,
            content: post.content,
            createdAt: post.createdAt,
            author: {
                _id: post.authorId._id,
                name: post.authorId.name,
                email: post.authorId.email,
                avatar: postProfileMap[post.authorId._id.toString()]?.avatar || "",
            },
        }));

        // Enrich users with avatar
        const userIds = users.map((u) => u._id.toString());
        const userProfiles = await Profile.find({ userId: { $in: userIds } }).lean();
        const userProfileMap = {};
        userProfiles.forEach((p) => { userProfileMap[p.userId.toString()] = p; });

        const enrichedUsers = users.map((u) => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            avatar: userProfileMap[u._id.toString()]?.avatar || "",
        }));

        res.status(200).json({
            success: true,
            posts: enrichedPosts,
            users: enrichedUsers,
            postsHasMore,
            usersHasMore,
            nextBeforePosts,
            nextBeforeUsers,
        });
    } catch (error) {
        console.log("Error in search:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
