const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger file paths
const errorLogPath = path.join(logsDir, "error.log");
const infoLogPath = path.join(logsDir, "info.log");

/**
 * Format date for logging
 * @returns {string} Formatted date string
 */
function getFormattedDate() {
  const now = new Date();
  return `${now.toISOString()} [${now.toLocaleTimeString()}]`;
}

/**
 * Write log to file
 * @param {string} filePath - Path to log file
 * @param {string} message - Log message
 */
function writeToFile(filePath, message) {
  const formattedMessage = `${getFormattedDate()} - ${message}\n`;
  fs.appendFile(filePath, formattedMessage, (err) => {
    if (err) console.error("Failed to write to log file:", err);
  });
}

/**
 * Custom logger with console and file output
 */
const logger = {
  info: (message, ...args) => {
    const formattedMessage = args.length ? `${message} ${args.join(" ")}` : message;
    console.log(`\x1b[32m[INFO]\x1b[0m ${formattedMessage}`);
    writeToFile(infoLogPath, `[INFO] ${formattedMessage}`);
  },

  error: (message, ...args) => {
    const formattedMessage = args.length ? `${message} ${args.join(" ")}` : message;
    console.error(`\x1b[31m[ERROR]\x1b[0m ${formattedMessage}`);
    writeToFile(errorLogPath, `[ERROR] ${formattedMessage}`);
  },

  warn: (message, ...args) => {
    const formattedMessage = args.length ? `${message} ${args.join(" ")}` : message;
    console.warn(`\x1b[33m[WARN]\x1b[0m ${formattedMessage}`);
    writeToFile(infoLogPath, `[WARN] ${formattedMessage}`);
  },

  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== "production") {
      const formattedMessage = args.length ? `${message} ${args.join(" ")}` : message;
      console.debug(`\x1b[36m[DEBUG]\x1b[0m ${formattedMessage}`);
    }
  },
};

module.exports = logger;
