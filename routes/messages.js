const express = require("express");
const router = express.Router();
const Channel = require("../models/channel");
const Message = require("../models/message");
const scheduler = require("../services/scheduler");
const whatsappService = require("../services/whatsapp");
const logger = require("../utils/logger");

// Messages page
router.get("/", async (req, res) => {
  try {
    // Get all channels
    const channels = await Channel.find().sort({ platform: 1, name: 1 });

    res.render("layout", {
      title: "Send Messages",
      content: "pages/messages",
      channels: channels,
    });
  } catch (error) {
    logger.error("Error loading messages page:", error);
    res.status(500).send("Error loading page");
  }
});

// Refresh WhatsApp channels
router.post("/refresh-channels", async (req, res) => {
  try {
    const result = await whatsappService.scrapeChannels();
    res.json({
      success: true,
      message: `Successfully refreshed ${result.length} WhatsApp channels`,
      channels: result,
    });
  } catch (error) {
    logger.error("Error refreshing channels:", error);
    res.status(500).json({
      success: false,
      message: "Error refreshing channels: " + error.message,
    });
  }
});

// Get all channels
router.get("/channels", async (req, res) => {
  try {
    const channels = await Channel.find().sort({ platform: 1, name: 1 });
    res.json({
      success: true,
      channels: channels,
    });
  } catch (error) {
    logger.error("Error fetching channels:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching channels: " + error.message,
    });
  }
});

// Send or schedule a message
router.post("/send", async (req, res) => {
  try {
    const { content, platforms, channels, scheduleTime } = req.body;

    // Validate request
    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    if (!platforms || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one platform must be selected",
      });
    }

    if (!channels || channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one channel must be selected",
      });
    }

    // Prepare message data
    const messageData = {
      content,
      platforms: Array.isArray(platforms) ? platforms : [platforms],
      channels,
      scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
    };

    let message;

    // Either schedule or send immediately
    if (scheduleTime) {
      message = await scheduler.scheduleMessage(messageData);
      res.json({
        success: true,
        message: "Message scheduled successfully",
        data: message,
      });
    } else {
      message = await scheduler.sendImmediately(messageData);
      res.json({
        success: true,
        message: "Message sent successfully",
        data: message,
      });
    }
  } catch (error) {
    logger.error("Error sending/scheduling message:", error);
    res.status(500).json({
      success: false,
      message: "Error processing message: " + error.message,
    });
  }
});

module.exports = router;
