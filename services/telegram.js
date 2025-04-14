const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
require("dotenv").config();
const { TelegramChannel, TelegramUser } = require("../models/telegram");

// Path for Telegram token storage
const tokenPath = path.join(__dirname, "../data/telegram-token.json");

const TelegramBot = require("node-telegram-bot-api");
const token = process.env.TELEGRAM_BOT_TOKEN;

logger.info("Telegram bot token:", token);

if (!token) {
  logger.error("Telegram bot token is not provided. Please set TELEGRAM_BOT_TOKEN environment variable.");
  process.exit(1);
}

/**
 * Save Telegram bot token
 * @param {string} token - Telegram bot token
 * @returns {Promise<boolean>} Success status
 */
const saveToken = (token) => {
  return new Promise((resolve, reject) => {
    try {
      const data = JSON.stringify({ token, savedAt: new Date() });
      fs.writeFileSync(tokenPath, data);
      logger.info("Telegram token saved successfully");
      resolve(true);
    } catch (error) {
      logger.error("Error saving Telegram token:", error);
      reject(error);
    }
  });
};

/**
 * Get current Telegram token
 * @returns {string|null} Stored token or null
 */
const getToken = () => {
  try {
    if (fs.existsSync(tokenPath)) {
      const data = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      return data.token;
    }
    return null;
  } catch (error) {
    logger.error("Error reading Telegram token:", error);
    return null;
  }
};

/**
 * Check if token exists
 * @returns {boolean} Whether token exists
 */
const hasToken = () => {
  try {
    return fs.existsSync(tokenPath) && getToken() !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Send a message to a Telegram chat
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message to send
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Telegram API response
 */
const sendMessage = async (chatId, message, options = {}) => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("Telegram token not found");
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(apiUrl, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      ...options,
    });

    logger.info(`Message sent to Telegram chat ${chatId}`);
    return {
      success: true,
      messageId: response.data.result.message_id,
      chatId,
    };
  } catch (error) {
    logger.error(`Error sending Telegram message to ${chatId}:`, error);
    return {
      success: false,
      error: error.message,
      chatId,
    };
  }
};

/**
 * Send messages to multiple Telegram channels
 * @param {string} message - Message content
 * @param {Array} channels - Channel objects with { _id, name, chatId }
 * @returns {Promise<Array>} Results of sending
 */
const sendChannelMessages = async (message, channels) => {
  if (!hasToken()) {
    throw new Error("Telegram token not configured");
  }

  logger.info(`Sending message to ${channels.length} Telegram channels`);
  const results = [];

  for (const channel of channels) {
    try {
      // ChatId may be stored in different ways, try to extract it
      const chatId = channel.chatId || channel.telegramId || channel.name;

      if (!chatId) {
        results.push({
          channel: channel.name,
          platform: "telegram",
          status: "failed",
          error: "Missing chat ID",
          timestamp: new Date(),
        });
        continue;
      }

      const result = await sendMessage(chatId, message);

      results.push({
        channel: channel.name,
        platform: "telegram",
        status: result.success ? "success" : "failed",
        error: result.error || null,
        timestamp: new Date(),
      });

      // Add random delay between messages (1-3 seconds)
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      logger.error(`Error sending to Telegram channel ${channel.name}:`, error);
      results.push({
        channel: channel.name,
        platform: "telegram",
        status: "failed",
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  return results;
};

const bot = new TelegramBot(token, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString();

  // نتجنب رسائل القنوات
  if (msg.chat.type === "private") {
    const { username, first_name, last_name } = msg.from;

    try {
      const exists = await TelegramUser.findOne({ chatId });
      if (!exists) {
        await TelegramUser.create({
          chatId,
          username,
          firstName: first_name,
          lastName: last_name,
        });
        console.log(`✅ تم حفظ المستخدم: ${username || chatId}`);
      }
    } catch (err) {
      console.error("❌ خطأ أثناء حفظ المستخدم:", err);
    }
  }
});

bot.on("channel_post", async (msg) => {
  const channelId = msg.chat.id.toString(); // مهم يكون string عشان MongoDB
  const channelTitle = msg.chat.title;

  try {
    const exists = await TelegramChannel.findOne({ channelId });

    if (!exists) {
      await TelegramChannel.create({ channelId, title: channelTitle });
      console.log(`✅ تم حفظ القناة: ${channelTitle} (${channelId})`);
    } else {
      console.log(`ℹ️ القناة (${channelTitle}) موجودة بالفعل`);
    }
  } catch (err) {
    console.error("❌ خطأ أثناء الحفظ:", err);
  }
});

async function broadcastMessage(text) {
  const users = await TelegramUser.find({});
  const channels = await TelegramChannel.find({});

  const allChatIds = [...users].filter((item) => item && item.chatId).map((item) => item.chatId);

  for (const chatId of allChatIds) {
    try {
      await bot.sendMessage(chatId, text);
      console.log(`✅ تم الإرسال إلى ${chatId}`);
    } catch (err) {
      console.error(`❌ فشل الإرسال إلى ${chatId}:`, err.description || err.message);
    }
  }

  const allChannelsIds = [...channels].filter((item) => item && item.channelId).map((item) => item.channelId);
  for (const channelId of allChannelsIds) {
    try {
      await bot.sendMessage(channelId, text);
      console.log(`✅ تم الإرسال إلى ${channelId}`);
    } catch (err) {
      console.error(`❌ فشل الإرسال إلى ${channelId}:`, err.description || err.message);
    }
  }
  console.log(`✅ تم إرسال الرسالة إلى ${allChatIds.length} مستخدمين و ${allChannelsIds.length} قنوات`);
}

module.exports = {
  saveToken,
  getToken,
  hasToken,
  sendMessage,
  sendChannelMessages,
  broadcastMessage,
};
