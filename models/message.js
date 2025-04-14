const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  formattedContent: {
    whatsapp: String,
    telegram: String,
  },
  platforms: {
    type: [String],
    enum: ["whatsapp", "telegram", "both"],
    default: ["whatsapp"],
  },
  channels: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
    },
  ],
  scheduledTime: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "sending", "completed", "failed"],
    default: "pending",
  },
  sentAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  results: [
    {
      channel: String,
      platform: String,
      status: String,
      timestamp: Date,
      error: String,
    },
  ],
});

messageSchema.index({ status: 1, scheduledTime: 1 });

module.exports = mongoose.model("Message", messageSchema);
