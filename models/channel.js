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
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create a compound index on name and platform for uniqueness
channelSchema.index({ name: 1, platform: 1 }, { unique: true });

// Add pre-save hook for debugging
channelSchema.pre("save", function (next) {
  console.log(`Saving channel: ${this.name} (${this.platform}), isAdmin: ${this.isAdmin}`);
  next();
});

const Channel = mongoose.model("Channel", channelSchema);

module.exports = Channel;
