import Post from "../models/post.model.js";
import Comment from "../models/thread.model.js";
import Community from "../models/community.model.js";
import Profile from "../models/profile.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { io } from "../socket.js";
import { trackReputationSignal } from "../utils/reputationSignals.js";

// ── Get Feed ────────────────────────────────────────────────────────────────
export const getFeed = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const tag = req.query.tag || null;
        const channelId = req.query.channelId || null;

        const filter = { communityId: req.communityId };
        if (tag) filter.tags = tag;
        if (channelId) filter.channelId = channelId;

        const totalPosts = await Post.countDocuments(filter);
        const totalPages = Math.ceil(totalPosts / limit) || 1;
        const skip = (page - 1) * limit;

        const posts = await Post.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("authorId", "name email")
            .lean();

        // Fetch community name
        const community = await Community.findById(req.communityId).select("name owner").lean();
        const communityName = community?.name || "";

        // Attach author profiles (avatar) and community roles
        const authorIds = [...new Set(posts.map((p) => p.authorId._id.toString()))];
        const profiles = await Profile.find({ userId: { $in: authorIds } }).lean();
        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        // Fetch user memberships to determine roles in this community
        const users = await User.find({ _id: { $in: authorIds } }).select("memberships").lean();
        const roleMap = {};
        users.forEach((u) => {
            const membership = u.memberships?.find(
                (m) => m.communityId?.toString() === req.communityId
            );
            roleMap[u._id.toString()] = membership?.role || "member";
        });

        const enrichedPosts = posts.map((post) => {
            const authorIdStr = post.authorId._id.toString();
            const prof = profileMap[authorIdStr];
            return {
                ...post,
                communityName,
                author: {
                    _id: post.authorId._id,
                    name: post.authorId.name,
                    email: post.authorId.email,
                    avatar: prof?.avatar || "",
                    reputation: prof?.reputation || 0,
                    tier: prof?.tier || "free",
                    communityRole: roleMap[authorIdStr] || "member",
                },
            };
        });

        res.status(200).json({
            success: true,
            posts: enrichedPosts,
            currentPage: page,
            totalPages,
            totalPosts,
        });
    } catch (error) {
        console.log("Error in getFeed:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Create Post ─────────────────────────────────────────────────────────────
export const createPost = async (req, res) => {
    try {
        const { content, mediaURLs, resourceLinks, tags, communityId, channelId, poll, mentions } = req.body;

        const targetCommunityId = req.communityId;

        const normalizedResourceLinks = Array.isArray(resourceLinks)
            ? resourceLinks
                .map((link) => ({
                    url: typeof link?.url === "string" ? link.url.trim() : "",
                    label: typeof link?.label === "string" ? link.label.trim() : "",
                }))
                .filter((link) => {
                    if (!link.url) return false;
                    try {
                        const parsed = new URL(link.url);
                        return ["http:", "https:"].includes(parsed.protocol);
                    } catch {
                        return false;
                    }
                })
                .slice(0, 8)
            : [];

        const hasMedia = Array.isArray(mediaURLs) && mediaURLs.length > 0;
        const hasValidLinks = normalizedResourceLinks.length > 0;

        // Require at least one meaningful payload: text, media, links, or poll
        if ((!content || !content.trim()) && !poll?.question && !hasMedia && !hasValidLinks) {
            return res.status(400).json({
                success: false,
                message: "Post content, media, links, or a poll question is required",
            });
        }

        const postData = {
            communityId: targetCommunityId,
            channelId: channelId || null,
            authorId: req.userId,
            content: (content || "").trim(),
            mediaURLs: mediaURLs || [],
            resourceLinks: normalizedResourceLinks,
            tags: tags || [],
            mentions: Array.isArray(mentions) ? mentions : [],
        };

        // Attach poll if provided
        if (poll?.question && Array.isArray(poll.options) && poll.options.length >= 2) {
            postData.poll = {
                question: poll.question.trim(),
                options: poll.options.slice(0, 6).map((opt) => ({
                    text: (typeof opt === "string" ? opt : opt.text || "").trim(),
                    votes: [],
                })),
            };
        }

        const post = await Post.create(postData);
        await trackReputationSignal({
            userId: req.userId,
            communityId: targetCommunityId,
            signal: "post_created",
        });

        const populated = await Post.findById(post._id)
            .populate("authorId", "name email")
            .lean();

        const profile = await Profile.findOne({ userId: req.userId }).lean();

        // Fetch community name and author's role
        const community = await Community.findById(targetCommunityId).select("name").lean();
        const authorUser = await User.findById(req.userId).select("memberships name").lean();
        const membership = authorUser?.memberships?.find(
            (m) => m.communityId?.toString() === targetCommunityId
        );

        const enrichedPost = {
            ...populated,
            communityName: community?.name || "",
            author: {
                _id: populated.authorId._id,
                name: populated.authorId.name,
                email: populated.authorId.email,
                avatar: profile?.avatar || "",
                communityRole: membership?.role || "member",
            },
        };

        // Emit real-time event
        io.to("feed").emit("new_post", enrichedPost);

        // ── Mention notifications ───────────────────────────────────────────
        if (Array.isArray(mentions) && mentions.length > 0) {
            const mentionerName = authorUser?.name || "Someone";
            const postSnippet = (content || "").trim().slice(0, 120);

            for (const mentionedUserId of mentions) {
                // Skip self-mention
                if (mentionedUserId === req.userId) continue;
                try {
                    const notification = await Notification.create({
                        userId: mentionedUserId,
                        type: "mention",
                        meta: {
                            communityId: targetCommunityId,
                            postId: post._id,
                            mentionerName,
                            postSnippet,
                        },
                    });
                    io.to(`user:${mentionedUserId}`).emit("new_notification", notification);
                } catch (notifErr) {
                    console.log("⚠️  Failed to create mention notification:", notifErr);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: "Post created successfully",
            post: enrichedPost,
        });
    } catch (error) {
        console.log("Error in createPost:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── React to Post (like toggle) ─────────────────────────────────────────────
export const reactToPost = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const userId = req.userId;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        const alreadyLiked = post.likedBy.some((id) => id.toString() === userId);

        if (alreadyLiked) {
            // Unlike
            post.likedBy.pull(userId);
            post.likesCount = Math.max(0, post.likesCount - 1);
        } else {
            // Like
            post.likedBy.push(userId);
            post.likesCount += 1;
        }

        await post.save();

        // ── Reputation: +1 on like, -1 on unlike (skip self-likes) ──────────
        const postAuthor = post.authorId.toString();
        if (postAuthor !== userId) {
            const likeMultiplier = alreadyLiked ? -1 : 1;
            await trackReputationSignal({
                userId: postAuthor,
                communityId: post.communityId,
                signal: "post_like_received",
                multiplier: likeMultiplier,
            });
            await trackReputationSignal({
                userId,
                communityId: post.communityId,
                signal: "post_like_given",
                multiplier: likeMultiplier,
            });
        }

        const reactionData = {
            postId,
            likesCount: post.likesCount,
            likedBy: post.likedBy,
            userId,
            action: alreadyLiked ? "unlike" : "like",
        };

        // Emit real-time event
        io.to("feed").emit("new_reaction", reactionData);

        res.status(200).json({
            success: true,
            ...reactionData,
        });
    } catch (error) {
        console.log("Error in reactToPost:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Add Comment (Reply) ─────────────────────────────────────────────────────
export const addComment = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const { content, mentions } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Comment content is required",
            });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({
                success: false,
                message: "Post not found",
            });
        }

        const comment = await Comment.create({
            postId,
            authorId: req.userId,
            content: content.trim(),
        });

        post.commentsCount += 1;
        await post.save();

        // ── Reputation: +1 for commenter participation ─────────────────────
        await trackReputationSignal({
            userId: req.userId,
            communityId: post.communityId,
            signal: "comment_created",
        });

        // ── Reputation: +2 for receiving a reply (skip self-replies) ────────
        const postAuthorId = post.authorId.toString();
        if (postAuthorId !== req.userId) {
            await trackReputationSignal({
                userId: postAuthorId,
                communityId: post.communityId,
                signal: "reply_received",
            });
        }

        const populated = await Comment.findById(comment._id)
            .populate("authorId", "name email")
            .lean();

        const profile = await Profile.findOne({ userId: req.userId }).lean();

        const enrichedComment = {
            ...populated,
            author: {
                _id: populated.authorId._id,
                name: populated.authorId.name,
                email: populated.authorId.email,
                avatar: profile?.avatar || "",
            },
        };

        // Emit real-time feed event
        io.to("feed").emit("new_comment", {
            postId,
            comment: enrichedComment,
            commentsCount: post.commentsCount,
        });

        // ── Notify post author (if commenter ≠ author) ──────────────────────
        if (postAuthorId !== req.userId) {
            try {
                const commenter = await User.findById(req.userId).select("name").lean();
                const notification = await Notification.create({
                    userId: postAuthorId,
                    type: "reply",
                    meta: {
                        communityId: post.communityId?.toString?.() || post.communityId,
                        postId,
                        commentId: comment._id,
                        commenterName: commenter?.name || "Someone",
                        commentSnippet: content.trim().slice(0, 120),
                    },
                });

                // Push live notification via user-specific socket room
                io.to(`user:${postAuthorId}`).emit("new_notification", notification);
            } catch (notifErr) {
                // Non-critical — log but don't fail the request
                console.log("⚠️  Failed to create reply notification:", notifErr);
            }
        }

        // ── Mention notifications in comments ───────────────────────────────
        if (Array.isArray(mentions) && mentions.length > 0) {
            const commenter = await User.findById(req.userId).select("name").lean();
            const mentionerName = commenter?.name || "Someone";

            for (const mentionedUserId of mentions) {
                // Skip self-mention and post author (already notified via reply)
                if (mentionedUserId === req.userId) continue;
                if (mentionedUserId === postAuthorId) continue;
                try {
                    const notification = await Notification.create({
                        userId: mentionedUserId,
                        type: "mention",
                        meta: {
                            communityId: post.communityId?.toString?.() || post.communityId,
                            postId,
                            commentId: comment._id,
                            mentionerName,
                            postSnippet: content.trim().slice(0, 120),
                        },
                    });
                    io.to(`user:${mentionedUserId}`).emit("new_notification", notification);
                } catch (notifErr) {
                    console.log("⚠️  Failed to create comment mention notification:", notifErr);
                }
            }
        }

        res.status(201).json({
            success: true,
            message: "Comment added",
            comment: enrichedComment,
        });
    } catch (error) {
        console.log("Error in addComment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Mark Reply as Helpful (post author only) ───────────────────────────────
export const markReplyHelpful = async (req, res) => {
    try {
        const { postId, replyId } = req.params;
        const actorUserId = req.userId;

        const post = await Post.findById(postId).lean();
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (post.authorId.toString() !== actorUserId) {
            return res.status(403).json({
                success: false,
                message: "Only the original post author can mark replies as helpful",
            });
        }

        const targetReply = await Comment.findOne({ _id: replyId, postId });
        if (!targetReply) {
            return res.status(404).json({ success: false, message: "Reply not found for this post" });
        }

        if (targetReply.authorId.toString() === actorUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot mark your own reply as helpful",
            });
        }

        if (targetReply.helpfulByAuthor) {
            return res.status(200).json({
                success: true,
                message: "Reply is already marked helpful",
                replyId: targetReply._id,
            });
        }

        const previouslyHelpfulReply = await Comment.findOne({
            postId,
            helpfulByAuthor: true,
            _id: { $ne: replyId },
        });

        if (previouslyHelpfulReply) {
            previouslyHelpfulReply.helpfulByAuthor = false;
            previouslyHelpfulReply.helpfulMarkedAt = null;
            await previouslyHelpfulReply.save();
            await trackReputationSignal({
                userId: previouslyHelpfulReply.authorId,
                communityId: post.communityId,
                signal: "helpful_reply_received",
                multiplier: -1,
            });
        }

        targetReply.helpfulByAuthor = true;
        targetReply.helpfulMarkedAt = new Date();
        await targetReply.save();

        await trackReputationSignal({
            userId: targetReply.authorId,
            communityId: post.communityId,
            signal: "helpful_reply_received",
        });

        res.status(200).json({
            success: true,
            message: "Reply marked as helpful",
            replyId: targetReply._id,
            postId,
        });
    } catch (error) {
        console.log("Error in markReplyHelpful:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get Comments for a Post ──────────────────────────────────────────────────
export const getComments = async (req, res) => {
    try {
        const { id: postId } = req.params;

        const comments = await Comment.find({ postId })
            .sort({ createdAt: 1 })
            .populate("authorId", "name email")
            .lean();

        const authorIds = [...new Set(comments.map((c) => c.authorId._id.toString()))];
        const profiles = await Profile.find({ userId: { $in: authorIds } }).lean();
        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        const enriched = comments.map((c) => ({
            ...c,
            author: {
                _id: c.authorId._id,
                name: c.authorId.name,
                email: c.authorId.email,
                avatar: profileMap[c.authorId._id.toString()]?.avatar || "",
                tier: profileMap[c.authorId._id.toString()]?.tier || "free",
            },
        }));

        res.status(200).json({ success: true, comments: enriched });
    } catch (error) {
        console.log("Error in getComments:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Vote on Poll ─────────────────────────────────────────────────────────────
export const voteOnPoll = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const { optionIndex } = req.body;
        const userId = req.userId;

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }

        if (!post.poll || !post.poll.question) {
            return res.status(400).json({ success: false, message: "This post has no poll" });
        }

        if (optionIndex == null || optionIndex < 0 || optionIndex >= post.poll.options.length) {
            return res.status(400).json({ success: false, message: "Invalid option index" });
        }

        // Check if user already voted on any option
        const alreadyVoted = post.poll.options.some((opt) =>
            opt.votes.map((v) => v.toString()).includes(userId)
        );

        if (alreadyVoted) {
            return res.status(400).json({ success: false, message: "You have already voted" });
        }

        post.poll.options[optionIndex].votes.push(userId);
        await post.save();

        // Build vote data for socket
        const pollData = {
            postId,
            poll: post.poll,
            userId,
            optionIndex,
        };

        io.to("feed").emit("poll_vote", pollData);

        res.status(200).json({ success: true, ...pollData });
    } catch (error) {
        console.log("Error in voteOnPoll:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Toggle Save / Unsave Post (Bookmark) ────────────────────────────────────
export const toggleSavePost = async (req, res) => {
    try {
        const { id: postId } = req.params;

        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        const profile = await Profile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

        const idx = profile.savedPosts.indexOf(postId);
        let saved;
        if (idx === -1) {
            profile.savedPosts.push(postId);
            saved = true;
        } else {
            profile.savedPosts.splice(idx, 1);
            saved = false;
        }
        await profile.save();

        res.status(200).json({
            success: true,
            saved,
            message: saved ? "Post saved" : "Post unsaved",
            postId,
        });
    } catch (error) {
        console.log("Error in toggleSavePost:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Get Saved Posts ──────────────────────────────────────────────────────────
export const getSavedPosts = async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.userId }).lean();
        if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

        if (!profile.savedPosts || profile.savedPosts.length === 0) {
            return res.status(200).json({ success: true, posts: [] });
        }

        const posts = await Post.find({ _id: { $in: profile.savedPosts } })
            .sort({ createdAt: -1 })
            .populate("authorId", "name email")
            .lean();

        // Enrich with author avatar, role, community name
        const authorIds = [...new Set(posts.map((p) => p.authorId?._id?.toString()).filter(Boolean))];
        const profiles = await Profile.find({ userId: { $in: authorIds } }).select("userId avatar").lean();
        const profileMap = {};
        profiles.forEach((p) => { profileMap[p.userId.toString()] = p; });

        const communityIds = [...new Set(posts.map((p) => p.communityId?.toString()).filter(Boolean))];
        const communities = await Community.find({ _id: { $in: communityIds } }).select("name").lean();
        const communityMap = {};
        communities.forEach((c) => { communityMap[c._id.toString()] = c.name; });

        const enriched = posts.map((post) => {
            const prof = profileMap[post.authorId?._id?.toString()];
            return {
                ...post,
                communityName: communityMap[post.communityId?.toString()] || "",
                author: {
                    _id: post.authorId?._id,
                    name: post.authorId?.name,
                    email: post.authorId?.email,
                    avatar: prof?.avatar || "",
                },
            };
        });

        res.status(200).json({ success: true, posts: enriched });
    } catch (error) {
        console.log("Error in getSavedPosts:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
