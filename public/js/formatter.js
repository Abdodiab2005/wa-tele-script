/**
 * Message Formatter for WhatsApp and Telegram platforms
 *
 * This module handles the conversion of rich text formatting to
 * platform-specific syntax for WhatsApp and Telegram.
 */

/**
 * Format text for WhatsApp
 * @param {string} text - Input text with rich formatting markers
 * @returns {string} - Text formatted for WhatsApp
 */
function formatForWhatsApp(text) {
  if (!text) return "";

  return text
    .replace(/\*\*(.*?)\*\*/g, "*$1*") // bold
    .replace(/\*(.*?)\*/g, "*$1*") // already formatted bold
    .replace(/_(.*?)_/g, "_$1_") // italic
    .replace(/~~(.*?)~~/g, "~$1~") // strikethrough
    .replace(/```(.*?)```/gs, "```$1```") // multiline code
    .replace(/`(.*?)`/g, "```$1```"); // inline code
}

/**
 * Format text for Telegram
 * @param {string} text - Input text with rich formatting markers
 * @returns {string} - Text formatted for Telegram
 */
function formatForTelegram(text) {
  if (!text) return "";

  return text
    .replace(/\*(.*?)\*/g, "**$1**") // convert single asterisk to double
    .replace(/\*\*(.*?)\*\*/g, "**$1**") // keep double asterisk
    .replace(/_(.*?)_/g, "_$1_") // italic (already correct)
    .replace(/~~(.*?)~~/g, "~~$1~~") // strikethrough (already correct)
    .replace(/```(.*?)```/gs, "`$1`") // convert multiline code to inline
    .replace(/`(.*?)`/g, "`$1`"); // inline code (already correct)
}

/**
 * Format text for both platforms
 * @param {string} text - Input text with rich formatting markers
 * @returns {Object} - Object with text formatted for both platforms
 */
function formatMessage(text) {
  return {
    whatsapp: formatForWhatsApp(text),
    telegram: formatForTelegram(text),
  };
}

// For browser use
if (typeof window !== "undefined") {
  window.TextFormatter = {
    formatForWhatsApp,
    formatForTelegram,
    formatMessage,
  };
}

// For Node.js use
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatForWhatsApp,
    formatForTelegram,
    formatMessage,
  };
}
