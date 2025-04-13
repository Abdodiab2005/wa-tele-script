const express = require("express");
const router = express.Router();
const Message = require("../models/message");
const logger = require("../utils/logger");

// Message history page
router.get("/", async (req, res) => {
  try {
    // Get all messages, sorted by newest first
    const messages = await Message.find().sort({ createdAt: -1 }).populate("channels").limit(50);

    res.render("layout", {
      title: "Message History",
      content: "pages/history",
      messages: messages,
    });
  } catch (error) {
    logger.error("Error loading history page:", error);
    res.status(500).send("Error loading page");
  }
});

// Get message details
router.get("/:id", async (req, res) => {
  try {
    const message = await Message.findById(req.params.id).populate("channels");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    res.json({
      success: true,
      message: message,
    });
  } catch (error) {
    logger.error("Error fetching message details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching message details: " + error.message,
    });
  }
});

module.exports = router;
