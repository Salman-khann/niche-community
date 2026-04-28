import mongoose from "mongoose";

const permissionOverwriteSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Role ID or User ID
    type: { type: String, enum: ["role", "member"], required: true },
    allow: { type: [String], default: [] },
    deny: { type: [String], default: [] },
}, { _id: true });

const channelSchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["text", "voice", "forum", "announcement"], default: "text" },
    isPrivate: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    categoryId: { type: mongoose.Schema.Types.ObjectId, default: null },
    isSynced: { type: Boolean, default: true },
    position: { type: Number, default: 0 },
    permissionOverwrites: { type: [permissionOverwriteSchema], default: [] },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

// Each channel name must be unique within its community
channelSchema.index({ communityId: 1, name: 1 }, { unique: true });
channelSchema.index({ createdAt: 1 });

export default mongoose.model("Channel", channelSchema);
