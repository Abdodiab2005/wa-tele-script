// models/zekr.js
const mongoose = require("mongoose");

const zekrSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["morning", "evening"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Zekr", zekrSchema);
