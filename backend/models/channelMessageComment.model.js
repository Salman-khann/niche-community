import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true, trim: true, maxlength: 16 },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: false });

const channelMessageCommentSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: "ChannelMessage", required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  reactions: { type: [reactionSchema], default: [] },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

channelMessageCommentSchema.index({ messageId: 1, createdAt: 1 });
channelMessageCommentSchema.index({ messageId: 1, _id: -1 });

export default mongoose.model("ChannelMessageComment", channelMessageCommentSchema);
