import mongoose from "mongoose";

const dmMessageSchema = new mongoose.Schema({
  threadId: { type: mongoose.Schema.Types.ObjectId, ref: "DmThread", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "", trim: true },
  mediaURLs: { type: [String], default: [] },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "DmMessage", default: null },
  isEdited: { type: Boolean, default: false },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

dmMessageSchema.index({ threadId: 1, createdAt: 1 });

export default mongoose.model("DmMessage", dmMessageSchema);
