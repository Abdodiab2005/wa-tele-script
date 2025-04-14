const Message = require("../models/message");
const Channel = require("../models/channel");
const whatsappService = require("./whatsapp");
const telegramService = require("./telegram");
const logger = require("../utils/logger");

/**
 * Initialize scheduler service
 */
function initialize() {
  // Run every 30 seconds
  setInterval(checkScheduledMessages, 30000);
  logger.info("Message scheduler initialized");
}

/**
 * Check for scheduled messages that need to be sent
 */
async function checkScheduledMessages() {
  try {
    // Find messages that are scheduled and due to be sent
    const now = new Date();
    const messages = await Message.find({
      status: "pending",
      scheduledTime: { $lte: now },
    });

    if (messages.length > 0) {
      logger.info(`Found ${messages.length} scheduled messages to send`);
    }

    // Process each message
    for (const message of messages) {
      try {
        // Update status to sending
        message.status = "sending";
        await message.save();

        // Get all selected channels
        const selectedChannels = await Promise.all(message.channels.map((channelId) => Channel.findById(channelId)));

        // Filter out any null results
        const validChannels = selectedChannels.filter((channel) => channel);

        // Group channels by platform
        const whatsappChannels = validChannels.filter((channel) => channel.platform === "whatsapp");
        const telegramChannels = validChannels.filter((channel) => channel.platform === "telegram");

        const results = [];

        // Process WhatsApp messages
        if (whatsappChannels.length > 0) {
          try {
            logger.info(`Sending scheduled message to ${whatsappChannels.length} WhatsApp channels`);
            const whatsappContent = message.formattedContent?.whatsapp || message.content;

            const whatsappResults = await whatsappService.sendChannelMessages(
              whatsappContent,
              whatsappChannels.map((c) => c.name)
            );

            results.push(...whatsappResults);
          } catch (whatsappError) {
            logger.error("Error sending scheduled WhatsApp messages:", whatsappError);
            results.push({
              platform: "whatsapp",
              status: "failed",
              error: whatsappError.message,
              timestamp: new Date(),
            });
          }
        }

        // Process Telegram messages
        if (telegramChannels.length > 0) {
          try {
            logger.info(`Sending scheduled message to ${telegramChannels.length} Telegram channels`);
            const telegramContent = message.formattedContent?.telegram || message.content;

            const telegramResults = await telegramService.sendChannelMessages(telegramContent, telegramChannels);

            results.push(...telegramResults);
          } catch (telegramError) {
            logger.error("Error sending scheduled Telegram messages:", telegramError);
            results.push({
              platform: "telegram",
              status: "failed",
              error: telegramError.message,
              timestamp: new Date(),
            });
          }
        }

        // Update message with results
        message.results = results;
        message.status = "completed";
        message.sentAt = new Date();
        await message.save();

        logger.info(`Scheduled message ${message._id} sent successfully`);
      } catch (error) {
        logger.error(`Error sending scheduled message ${message._id}:`, error);

        // Update message status to failed
        message.status = "failed";
        message.results = [
          {
            status: "failed",
            error: error.message,
            timestamp: new Date(),
          },
        ];
        await message.save();
      }
    }
  } catch (error) {
    logger.error("Error checking scheduled messages:", error);
  }
}

/**
 * Schedule a message for later sending
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message
 */
async function scheduleMessage(messageData) {
  try {
    const message = new Message({
      ...messageData,
      status: "pending",
    });
    await message.save();
    logger.info(`Message scheduled with ID: ${message._id} for ${messageData.scheduledTime}`);
    return message;
  } catch (error) {
    logger.error("Error scheduling message:", error);
    throw error;
  }
}

/**
 * Send a message immediately
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Message with results
 */
async function sendImmediately(messageData) {
  try {
    // Create message record
    const message = new Message({
      ...messageData,
      status: "sending",
      scheduledTime: null,
    });
    await message.save();

    const results = [];

    // Get all selected channels
    const selectedChannels = await Promise.all(messageData.channels.map((channelId) => Channel.findById(channelId)));

    // Filter out any null results
    const validChannels = selectedChannels.filter((channel) => channel);

    if (validChannels.length === 0) {
      throw new Error("No valid channels selected");
    }

    // Group channels by platform
    const whatsappChannels = validChannels.filter((channel) => channel.platform === "whatsapp");
    const telegramChannels = validChannels.filter((channel) => channel.platform === "telegram");

    // Log which platforms we're using
    const platforms = [];
    if (whatsappChannels.length > 0) platforms.push("WhatsApp");
    if (telegramChannels.length > 0) platforms.push("Telegram");

    logger.info(`Sending message to ${validChannels.length} channels across ${platforms.join(" and ")}`);

    // Process WhatsApp messages
    if (whatsappChannels.length > 0) {
      try {
        logger.info(`Sending to ${whatsappChannels.length} WhatsApp channels`);
        const whatsappContent = messageData.formattedContent?.whatsapp || messageData.content;

        const whatsappResults = await whatsappService.sendChannelMessages(
          whatsappContent,
          whatsappChannels.map((c) => c.name)
        );

        results.push(...whatsappResults);
      } catch (whatsappError) {
        logger.error("Error sending WhatsApp messages:", whatsappError);
        results.push({
          platform: "whatsapp",
          status: "failed",
          error: whatsappError.message,
          timestamp: new Date(),
        });
      }
    }

    // Process Telegram messages
    if (telegramChannels.length > 0) {
      try {
        logger.info(`Sending to ${telegramChannels.length} Telegram channels`);
        const telegramContent = messageData.formattedContent?.telegram || messageData.content;

        const telegramResults = await telegramService.sendChannelMessages(telegramContent, telegramChannels);

        results.push(...telegramResults);
      } catch (telegramError) {
        logger.error("Error sending Telegram messages:", telegramError);
        results.push({
          platform: "telegram",
          status: "failed",
          error: telegramError.message,
          timestamp: new Date(),
        });
      }
    }

    // Update message with results
    message.results = results;
    message.status = "completed";
    message.sentAt = new Date();
    await message.save();

    logger.info(`Message ${message._id} sent with ${results.length} delivery results`);
    return message;
  } catch (error) {
    logger.error("Error sending message:", error);
    throw error;
  }
}

module.exports = {
  initialize,
  scheduleMessage,
  sendImmediately,
  checkScheduledMessages,
};
