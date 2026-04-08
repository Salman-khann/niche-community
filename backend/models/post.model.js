import mongoose from "mongoose";

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: true });

const resourceLinkSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  label: { type: String, default: "", trim: true, maxlength: 120 },
}, { _id: true });

const postSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "", maxlength: 5000 },
  mediaURLs: { type: [String], default: [] },
  resourceLinks: { type: [resourceLinkSchema], default: [] },
  tags: { type: [String], default: [] },
  hashtags: { type: [String], default: [] },
  poll: {
    question: { type: String },
    options: [pollOptionSchema],
  },
  pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  pinnedAt: { type: Date, default: null },
  featuredBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  featuredAt: { type: Date, default: null },
  likesCount: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  commentsCount: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  flaggedAt: { type: Date, default: null },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  flagReason: { type: String, default: "" },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

// Index for efficient feed queries
postSchema.index({ communityId: 1, createdAt: -1 });
postSchema.index({ channelId: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ communityId: 1, featuredAt: -1, pinnedAt: -1, createdAt: -1 });

export default mongoose.model("Post", postSchema);