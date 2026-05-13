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

const permissionOverwriteSchema = new mongoose.Schema({
  id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Role ID or User ID
  type: { type: String, enum: ["role", "member"], required: true },
  allow: { type: [String], default: [] }, // Array of permission keys to allow
  deny: { type: [String], default: [] },  // Array of permission keys to deny
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
  categories: {
    type: [{
      name: { type: String, required: true },
      position: { type: Number, default: 0 },
      permissionOverwrites: { type: [permissionOverwriteSchema], default: [] },
    }],
    default: [
      { name: "TEXT CHANNELS", position: 0, permissionOverwrites: [] },
      { name: "VOICE CHANNELS", position: 1, permissionOverwrites: [] }
    ],
  },
  engagement: {
    systemMessages: {
      welcomeEnabled: { type: Boolean, default: true },
      welcomePromptEnabled: { type: Boolean, default: true },
      boostEnabled: { type: Boolean, default: true },
      tipsEnabled: { type: Boolean, default: true },
      channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
    },
    activityFeed: {
      displayEnabled: { type: Boolean, default: true },
    },
    defaultNotifications: {
      type: String,
      enum: ["all", "mentions"],
      default: "mentions",
    },
    afk: {
      channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
      timeout: { type: Number, default: 300 }, // 5 minutes in seconds
    }
  },
  access: {
    joinMethod: { type: String, enum: ["invite", "apply", "discoverable"], default: "invite" },
    isAgeRestricted: { type: Boolean, default: false },
    rules: {
      enabled: { type: Boolean, default: false },
      list: { type: [String], default: [] },
    },
  },
  safety: {
    verificationLevel: { type: String, enum: ["none", "low", "medium", "high", "highest"], default: "none" },
    explicitContentFilter: { type: String, enum: ["disabled", "members_without_roles", "all_members"], default: "members_without_roles" },
    twoFactorModeration: { type: Boolean, default: false },
  },
  community: {
    enabled: { type: Boolean, default: true },
    rulesChannelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
    updatesChannelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
    safetyChannelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
    primaryLanguage: { type: String, default: "English" },
    description: { type: String, default: "" },
  },
  onboarding: {
    enabled: { type: Boolean, default: false },
    steps: [{
      title: { type: String, required: true },
      description: { type: String, default: "" },
      icon: { type: String, default: "" },
      channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
    }],
    memberTags: { type: [String], default: [] },
  },
  emojis: {
    type: [{
      name: { type: String, required: true },
      url: { type: String, required: true },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
}, { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } });

export default mongoose.model("Community", communitySchema);
