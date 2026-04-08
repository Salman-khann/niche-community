import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  displayName: { type: String, default: "" },
  avatar: { type: String, default: "" },
  pronouns: { type: String, default: "" },
  bannerColor: { type: String, default: "#3f4f4f" },
  status: { type: String, default: "Eat Sleep Code Repeat" },
  presence: { type: String, enum: ["online", "idle", "dnd", "offline"], default: "online" },
  bio: { type: String, default: "", maxlength: 200 },
  dataPrivacy: {
    improveData: { type: Boolean, default: true },
    personalizeActivity: { type: Boolean, default: true },
    thirdPartyPersonalization: { type: Boolean, default: true },
    personalizeExperience: { type: Boolean, default: true },
    voiceClips: { type: Boolean, default: true },
  },
  notificationPrefs: {
    emailDigestEnabled: { type: Boolean, default: false },
    digestFrequency: { type: String, enum: ["daily", "weekly"], default: "daily" },
    lastDigestSentAt: { type: Date, default: null },
    pushEnabled: { type: Boolean, default: false },
  },
  skills: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  reputation: { type: Number, default: 0 },
  reputationSignals: {
    postsCreated: { type: Number, default: 0 },
    commentsCreated: { type: Number, default: 0 },
    repliesReceived: { type: Number, default: 0 },
    helpfulRepliesReceived: { type: Number, default: 0 },
    postLikesReceived: { type: Number, default: 0 },
    postLikesGiven: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    messageCommentsCreated: { type: Number, default: 0 },
    messageRepliesReceived: { type: Number, default: 0 },
    messageLikesReceived: { type: Number, default: 0 },
    messageLikesGiven: { type: Number, default: 0 },
  },
  stripeCustomerId: { type: String, default: null },
  stripeSubscriptionId: { type: String, default: null },
  tier: { type: String, enum: ["free", "premium", "enterprise"], default: "free" },
  subscriptionStatus: {
    type: String,
    enum: ["inactive", "active", "trialing", "past_due", "canceled", "unpaid"],
    default: "inactive",
  },
  isOnboarded: { type: Boolean, default: false },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
}, { timestamps: { createdAt: "joinedAt", updatedAt: "updatedAt" } });

export default mongoose.model("Profile", profileSchema);
