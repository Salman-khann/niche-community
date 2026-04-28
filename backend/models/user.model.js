import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  password: { type: String, required: true },
  googleId: { type: String, default: null },
  appleId: { type: String, default: null },
  linkedinId: { type: String, default: null },
  isBot: { type: Boolean, default: false },
  botKey: { type: String, default: null, index: true },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorRecoveryCodes: { type: [String], default: [] },
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
    isBanned: { type: Boolean, default: false },    notificationSettings: {
      serverMuted: { type: Boolean, default: false },
      serverSetting: { type: String, enum: ["all", "mentions", "nothing"], default: "all" },
      inAppAlerts: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      suppressEveryone: { type: Boolean, default: false },
      suppressRoles: { type: Boolean, default: false },
      suppressHighlights: { type: Boolean, default: false },
      muteNewEvents: { type: Boolean, default: false },
      mobilePush: { type: Boolean, default: true },
      channelOverrides: [{
        channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
        setting: { type: String, enum: ["default", "all", "mentions", "nothing", "muted"], default: "default" }
      }]
    }  }],
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
  refreshTokenHash: { type: String, default: null },
  refreshTokenExpiresAt: { type: Date, default: null },
  sessionVersion: { type: Number, default: 1 },
  lastActivityAt: { type: Date, default: Date.now },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model("User", userSchema);
