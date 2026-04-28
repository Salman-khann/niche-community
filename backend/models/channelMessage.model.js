import mongoose from "mongoose";

const channelMessageSchema = new mongoose.Schema({
  channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" },
  mediaURLs: { type: [String], default: [] },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  reactions: {
    type: [{
      emoji: { type: String, required: true },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    }],
    default: [],
  },
  likesCount: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  commentsCount: { type: Number, default: 0 },
  pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  flagged: { type: Boolean, default: false },
  flaggedAt: { type: Date, default: null },
  flaggedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  flagReason: { type: String, default: "" },
  flagReasons: { type: [String], default: [] },
  flagSource: { type: String, enum: ["user", "auto", "mixed", ""], default: "" },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ChannelMessage", default: null },
  isEdited: { type: Boolean, default: false },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

channelMessageSchema.index({ channelId: 1, createdAt: 1 });
channelMessageSchema.index({ channelId: 1, _id: -1 });

export default mongoose.model("ChannelMessage", channelMessageSchema);
