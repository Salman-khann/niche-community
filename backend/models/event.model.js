import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  date: { type: Date, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  location: { type: String, default: "" },
  locationType: { type: String, default: "somewhere_else" },
  coverImage: { type: String, default: "" },
  status: { type: String, enum: ["scheduled", "live", "ended"], default: "scheduled" },
  startedAt: { type: Date },
  endedAt: { type: Date },
  botReminders: {
    d24h: { type: Boolean, default: false },
    d1h: { type: Boolean, default: false },
    d10m: { type: Boolean, default: false },
  },
  rsvpList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

export default mongoose.model("Event", eventSchema);
