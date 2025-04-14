/**
 * Converts rich text formatting to platform-specific markup
 *
 * @param {string} text - The input rich text with markdown-style formatting
 * @returns {Object} Object containing the formatted text for each platform
 */
function formatMessage(text) {
  if (!text) return { whatsapp: "", telegram: "" };

  // Format for WhatsApp
  const whatsappText = text
    .replace(/\*\*(.*?)\*\*/g, "*$1*") // Bold: **text** -> *text*
    .replace(/\*(.*?)\*/g, "*$1*") // Already correct bold
    .replace(/_(.*?)_/g, "_$1_") // Already correct italic
    .replace(/~~(.*?)~~/g, "~$1~") // Strikethrough: ~~text~~ -> ~text~
    .replace(/`([^`]*?)`/g, "```$1```"); // Code: `text` -> ```text```

  // Format for Telegram
  const telegramText = text
    .replace(/\*(.*?)\*/g, "**$1**") // Bold: *text* -> **text**
    .replace(/\*\*(.*?)\*\*/g, "**$1**") // Already correct bold
    .replace(/_(.*?)_/g, "_$1_") // Already correct italic
    .replace(/~~(.*?)~~/g, "~~$1~~") // Already correct strikethrough
    .replace(/`([^`]*?)`/g, "`$1`"); // Already correct code

  return {
    whatsapp: whatsappText,
    telegram: telegramText,
  };
}

/**
 * Express middleware to format message content for all platforms
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function formatMessageMiddleware(req, res, next) {
  if (req.body && req.body.content) {
    const formatted = formatMessage(req.body.content);
    req.formattedContent = formatted;
  }
  next();
}

module.exports = {
  formatMessage,
  formatMessageMiddleware,
};
