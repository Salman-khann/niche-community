import mongoose from "mongoose";

const inviteCodeSchema = new mongoose.Schema({
  code: { type: String, required: true },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  expiresAt: { type: Date, default: null },
  isUsed: { type: Boolean, default: false },
}, { _id: true });

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  permissions: {
    viewChannels: { type: Boolean, default: false },
    createChannels: { type: Boolean, default: false },
    manageChannels: { type: Boolean, default: false },
    manageRoles: { type: Boolean, default: false },
    createEvents: { type: Boolean, default: false },
    createInvite: { type: Boolean, default: false },
    changeNickname: { type: Boolean, default: false },
    manageNicknames: { type: Boolean, default: false },
    kickMembers: { type: Boolean, default: false },
    banMembers: { type: Boolean, default: false },
    moderateContent: { type: Boolean, default: false },
    manageMessages: { type: Boolean, default: false },
    warnMembers: { type: Boolean, default: false },
    suspendMembers: { type: Boolean, default: false },
    viewAuditLog: { type: Boolean, default: false },
    editServerProfile: { type: Boolean, default: false },
  },
  color: { type: String, default: "#99aab5" },
  hoist: { type: Boolean, default: false },
  mentionable: { type: Boolean, default: false },
  position: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "" },
  bannerColor: { type: String, default: "" },
  traits: { type: [String], default: [] },
  profileDescription: { type: String, default: "" },
  kind: { type: String, enum: ["friends", "community"], default: "community" },
  template: { type: String, default: "custom" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  bannedUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, default: "" },
    executor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now }
  }],
  inviteCodes: { type: [inviteCodeSchema], default: [] },
  roles: { type: [roleSchema], default: [] },
  inviteRequestsEnabled: { type: Boolean, default: true },
  communityScore: { type: Number, default: 0 },
  scoreSignals: {
    postsCreated: { type: Number, default: 0 },
    commentsCreated: { type: Number, default: 0 },
    repliesReceived: { type: Number, default: 0 },
    helpfulRepliesMarked: { type: Number, default: 0 },
    postLikesReceived: { type: Number, default: 0 },
    messagesSent: { type: Number, default: 0 },
    messageCommentsCreated: { type: Number, default: 0 },
    messageRepliesReceived: { type: Number, default: 0 },
    messageLikesReceived: { type: Number, default: 0 },
    reactionsGiven: { type: Number, default: 0 },
  },
  botMeta: {
    lastDigestAt: { type: Date, default: null },
    raidMode: { type: Boolean, default: false },
  },
  blocklist: {
    type: [{
      value: { type: String, required: true, trim: true, lowercase: true },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

export default mongoose.model("Community", communitySchema);
