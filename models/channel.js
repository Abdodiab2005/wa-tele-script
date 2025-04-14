const mongoose = require("mongoose");

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["whatsapp", "telegram"],
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    chatId: {
      type: String,
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: "",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound index on name and platform for uniqueness
channelSchema.index({ name: 1, platform: 1 }, { unique: true });

const Channel = mongoose.model("Channel", channelSchema);

module.exports = Channel;
