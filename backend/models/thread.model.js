import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true, trim: true, maxlength: 16 },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: false });

const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true, maxlength: 2000 },
  reactions: { type: [reactionSchema], default: [] },
  helpfulByAuthor: { type: Boolean, default: false },
  helpfulMarkedAt: { type: Date, default: null },
}, { timestamps: true });

commentSchema.index({ postId: 1, createdAt: 1 });
commentSchema.index({ postId: 1, _id: -1 });
commentSchema.index({ postId: 1, helpfulByAuthor: 1 });

export default mongoose.model("Comment", commentSchema);
