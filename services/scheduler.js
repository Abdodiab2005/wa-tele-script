const Message = require("../models/message");
const whatsappService = require("./whatsapp");
const logger = require("../utils/logger");
const { broadcastMessage } = require("./telegram");
let schedulerInterval;

/**
 * Initialize the scheduler service
 */
function initialize() {
  // Run every 30 seconds
  schedulerInterval = setInterval(checkScheduledMessages, 30000);
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
    }).populate("channels");

    if (messages.length > 0) {
      logger.info(`Found ${messages.length} scheduled messages to send`);
    }

    // Process each message
    for (const message of messages) {
      try {
        // Update status to sending
        message.status = "sending";
        await message.save();

        const results = [];

        // Process WhatsApp messages
        if (message.platforms.includes("whatsapp") || message.platforms.includes("both")) {
          // Filter WhatsApp channels
          const whatsappChannels = message.channels
            .filter((channel) => channel.platform === "whatsapp")
            .map((channel) => channel.name);

          if (whatsappChannels.length > 0) {
            // Send the message
            const whatsappResults = await whatsappService.sendChannelMessages(message.content, whatsappChannels);

            results.push(...whatsappResults);
          }
        }

        // Process Telegram messages (placeholder for future)
        if (message.platforms.includes("telegram") || message.platforms.includes("both")) {
          // TODO: Implement Telegram sending logic
          logger.info("Telegram sending is not implemented yet");
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
 * Schedule a message for sending
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message
 */
async function scheduleMessage(messageData) {
  try {
    const message = new Message(messageData);
    await message.save();
    logger.info(`Message scheduled with ID: ${message._id}`);
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

    // Process WhatsApp messages
    if (messageData.platforms.includes("whatsapp") || messageData.platforms.includes("both")) {
      // Get channel names
      const whatsappChannels = (
        await Promise.all(
          messageData.channels
            .filter((channelId) => channelId)
            .map((channelId) => require("../models/channel").findById(channelId))
        )
      )
        .filter((channel) => channel && channel.platform === "whatsapp")
        .map((channel) => channel.name);

      if (whatsappChannels.length > 0) {
        // Send the message
        const whatsappResults = await whatsappService.sendChannelMessages(messageData.content, whatsappChannels);

        results.push(...whatsappResults);
      }
    }

    // Process Telegram messages (placeholder for future)
    if (messageData.platforms.includes("telegram") || messageData.platforms.includes("both")) {
      await broadcastMessage(messageData.content);
      logger.info("Telegram sending is not implemented yet");
    }

    // Update message with results
    message.results = results;
    message.status = "completed";
    message.sentAt = new Date();
    await message.save();

    logger.info(`Immediate message ${message._id} sent successfully`);
    return message;
  } catch (error) {
    logger.error("Error sending immediate message:", error);
    throw error;
  }
}

module.exports = {
  initialize,
  scheduleMessage,
  sendImmediately,
  checkScheduledMessages,
};
