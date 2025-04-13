const mongoose = require("mongoose");

// موديل القنوات
const telegramChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  title: String,
  addedAt: { type: Date, default: Date.now },
});
const TelegramChannel = mongoose.model("TelegramChannel", telegramChannelSchema);

// موديل المستخدمين
const telegramUserSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  addedAt: { type: Date, default: Date.now },
});
const TelegramUser = mongoose.model("TelegramUser", telegramUserSchema);

// التصدير
module.exports = {
  TelegramChannel,
  TelegramUser,
};
