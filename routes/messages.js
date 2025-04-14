const express = require("express");
const router = express.Router();
const Channel = require("../models/channel");
const Message = require("../models/message");
const scheduler = require("../services/scheduler");
const whatsappService = require("../services/whatsapp");
const telegramService = require("../services/telegram");
const logger = require("../utils/logger");

// Messages page - load all enabled channels
router.get("/", async (req, res) => {
  try {
    // Get all channels, sorted by platform and name
    const channels = await Channel.find({ enabled: true }).sort({ platform: 1, name: 1 }).lean();

    // Group channels by platform
    const whatsappChannels = channels.filter((c) => c.platform === "whatsapp" && c.isAdmin);
    const telegramChannels = channels.filter((c) => c.platform === "telegram");

    // Check if Telegram is configured
    const telegramConfigured = telegramService.hasToken();

    res.render("layout", {
      title: "Send Messages",
      content: "pages/messages",
      whatsappChannels,
      telegramChannels,
      telegramConfigured,
      channels,
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
    const channels = await Channel.find({ enabled: true }).sort({ platform: 1, name: 1 });
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

// Add new Telegram channel
router.post("/telegram-channel", async (req, res) => {
  try {
    const { name, chatId, description } = req.body;

    if (!name || !chatId) {
      return res.status(400).json({
        success: false,
        message: "Name and Chat ID are required",
      });
    }

    // Check if channel already exists
    const existingChannel = await Channel.findOne({
      name: name,
      platform: "telegram",
    });

    if (existingChannel) {
      return res.status(400).json({
        success: false,
        message: "Channel with this name already exists",
      });
    }

    // Create new channel
    const channel = new Channel({
      name,
      chatId,
      description: description || "",
      platform: "telegram",
      isAdmin: true,
      enabled: true,
    });

    await channel.save();

    res.json({
      success: true,
      message: "Telegram channel added successfully",
      channel,
    });
  } catch (error) {
    logger.error("Error adding Telegram channel:", error);
    res.status(500).json({
      success: false,
      message: "Error adding channel: " + error.message,
    });
  }
});

// Send or schedule a message
router.post("/send", async (req, res) => {
  try {
    const { content, formattedContent, channels, scheduleTime } = req.body;

    // Validate request
    if (!content) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    if (!channels || channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one channel must be selected",
      });
    }

    // Get selected channels from MongoDB to determine which platforms are being used
    const selectedChannels = await Promise.all(channels.map((channelId) => Channel.findById(channelId).lean()));

    // Filter out any null channels and group by platform
    const validChannels = selectedChannels.filter((ch) => ch);
    const platforms = [...new Set(validChannels.map((ch) => ch.platform))];

    logger.info(`Sending to platforms: ${platforms.join(", ")}`);

    // Prepare message data
    const messageData = {
      content,
      formattedContent,
      platforms,
      channels,
      scheduledTime: scheduleTime ? new Date(scheduleTime) : null,
    };

    let message;

    // Either schedule or send immediately
    if (scheduleTime) {
      message = await scheduler.scheduleMessage(messageData);
      res.json({
        success: true,
        message: `Message scheduled successfully to ${validChannels.length} channels across ${platforms.length} platforms`,
        data: message,
      });
    } else {
      message = await scheduler.sendImmediately(messageData);
      res.json({
        success: true,
        message: `Message sent successfully to ${validChannels.length} channels across ${platforms.length} platforms`,
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
