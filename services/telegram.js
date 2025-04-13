const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
require("dotenv").config();
const { TelegramChannel, TelegramUser } = require("../models/telegram");

// Telegram token storage path
const TOKEN_FILE = path.join(__dirname, "../data/telegram-token.json");

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
 * @returns {Promise<void>}
 */
async function saveToken(token) {
  try {
    const data = { token, updatedAt: new Date().toISOString() };
    await fs.promises.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2));
    logger.info("Telegram token saved successfully");
  } catch (error) {
    logger.error("Error saving Telegram token:", error);
    throw new Error(`Failed to save token: ${error.message}`);
  }
}

/**
 * Get stored Telegram bot token
 * @returns {Promise<string|null>} Telegram token or null
 */
async function getToken() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const data = JSON.parse(await fs.promises.readFile(TOKEN_FILE, "utf8"));
    return data.token;
  } catch (error) {
    logger.error("Error reading Telegram token:", error);
    return null;
  }
}

/**
 * Check if token exists and is valid
 * @returns {Promise<boolean>} True if valid token exists
 */
async function hasValidToken() {
  try {
    const token = await getToken();
    return !!token && /^\d+:[A-Za-z0-9_-]+$/.test(token);
  } catch (error) {
    logger.error("Error checking Telegram token validity:", error);
    return false;
  }
}

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
  hasValidToken,
  broadcastMessage,
};
