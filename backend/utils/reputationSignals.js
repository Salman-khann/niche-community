import Community from "../models/community.model.js";
import Profile from "../models/profile.model.js";

const SIGNAL_RULES = {
    post_created: {
        reputationDelta: 2,
        communityScoreDelta: 2,
        profileCounter: "postsCreated",
        communityCounter: "postsCreated",
    },
    comment_created: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "commentsCreated",
        communityCounter: "commentsCreated",
    },
    reply_received: {
        reputationDelta: 2,
        communityScoreDelta: 2,
        profileCounter: "repliesReceived",
        communityCounter: "repliesReceived",
    },
    helpful_reply_received: {
        reputationDelta: 10,
        communityScoreDelta: 5,
        profileCounter: "helpfulRepliesReceived",
        communityCounter: "helpfulRepliesMarked",
    },
    post_like_received: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "postLikesReceived",
        communityCounter: "postLikesReceived",
    },
    post_like_given: {
        reputationDelta: 0,
        communityScoreDelta: 0,
        profileCounter: "postLikesGiven",
        communityCounter: "reactionsGiven",
    },
    message_sent: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "messagesSent",
        communityCounter: "messagesSent",
    },
    message_comment_created: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "messageCommentsCreated",
        communityCounter: "messageCommentsCreated",
    },
    message_reply_received: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "messageRepliesReceived",
        communityCounter: "messageRepliesReceived",
    },
    message_like_received: {
        reputationDelta: 1,
        communityScoreDelta: 1,
        profileCounter: "messageLikesReceived",
        communityCounter: "messageLikesReceived",
    },
    message_like_given: {
        reputationDelta: 0,
        communityScoreDelta: 0,
        profileCounter: "messageLikesGiven",
        communityCounter: "reactionsGiven",
    },
};

export const trackReputationSignal = async ({ userId, communityId, signal, multiplier = 1 }) => {
    const rule = SIGNAL_RULES[signal];
    if (!rule || !userId || !communityId || multiplier === 0) return;

    const reputationDelta = (rule.reputationDelta || 0) * multiplier;
    const communityScoreDelta = (rule.communityScoreDelta || 0) * multiplier;

    const profileInc = {};
    if (reputationDelta !== 0) profileInc.reputation = reputationDelta;
    if (rule.profileCounter) profileInc[`reputationSignals.${rule.profileCounter}`] = multiplier;

    const communityInc = {};
    if (communityScoreDelta !== 0) communityInc.communityScore = communityScoreDelta;
    if (rule.communityCounter) communityInc[`scoreSignals.${rule.communityCounter}`] = multiplier;

    await Promise.all([
        Profile.findOneAndUpdate(
            { userId },
            {
                $inc: profileInc,
                $setOnInsert: { userId },
            },
            { upsert: true }
        ),
        Community.findByIdAndUpdate(communityId, { $inc: communityInc }),
    ]);
};
