import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  googleId: { type: String, default: null },
  appleId: { type: String, default: null },
  linkedinId: { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  role: { type: String, enum: ["user", "moderator", "admin"], default: "user" },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" },
  lastLogin: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  isInviteVerified: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  memberships: [{
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
    role: { type: String, enum: ["admin", "moderator", "member"], default: "member" },
    roles: { type: [String], default: [] },
    joinedAt: { type: Date, default: Date.now },
    warningsCount: { type: Number, default: 0 },
    suspensionEndDate: { type: Date, default: null },
    isBanned: { type: Boolean, default: false },
  }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friendRequests: {
    incoming: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],
    outgoing: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],
  },
  resetPasswordToken: String,
  resetPasswordExpiresAt: Date,
  verificationToken: String,
  verificationTokenExpiresAt: Date,
}, { timestamps: true });

export default mongoose.model("User", userSchema);
