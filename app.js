const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const scheduler = require("./services/scheduler");

// Initialize WhatsApp service
const whatsappService = require("./services/whatsapp");
const { initAzkarScheduler } = require("./services/azkar");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Data directory setup for storing session data
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info("Created data directory for session storage");
}

// MongoDB Connection with improved error handling
mongoose.set("debug", true); // Enable mongoose debug mode
mongoose
  .connect("mongodb://localhost:27017/whatsapp_telegram_auth", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info("MongoDB Connected");
    // Test database connection by writing and reading a test document
    const TestModel = mongoose.model("TestConnection", new mongoose.Schema({ test: String }));
    return TestModel.findOneAndUpdate(
      { test: "connection_test" },
      { test: "connection_test", timestamp: Date.now() },
      { upsert: true, new: true }
    );
  })
  .then((testDoc) => {
    logger.info(`MongoDB connection verified. Test document ID: ${testDoc._id}`);
  })
  .catch((err) => {
    logger.error("MongoDB Connection Error:", err);
    // Don't crash the app, but make it clear there's a database issue
    logger.error("Warning: App running without database functionality");
  });

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Set EJS as view engine with layout support
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Import routes
const indexRoutes = require("./routes/index");
const connectRoutes = require("./routes/connect");
const messagesRoutes = require("./routes/messages");
const historyRoutes = require("./routes/history");
const azkarRoutes = require("./routes/azkar");

// Use routes
app.use("/", indexRoutes);
app.use("/connect", connectRoutes);
app.use("/messages", messagesRoutes);
app.use("/history", historyRoutes);
app.use("/", azkarRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  logger.error(err.stack);
  res.status(500).render("pages/error", {
    title: "Error",
    error: process.env.NODE_ENV === "production" ? "Server Error" : err.message,
  });
});

whatsappService
  .initialize()
  .then(() => logger.info("WhatsApp service initialized"))
  .catch((err) => logger.error("WhatsApp service initialization failed:", err));

// Initialize scheduler service
scheduler.initialize();

// Start server
app.listen(PORT, () => {
  // Initialize Azkar scheduler immediately
  initAzkarScheduler()
    .then(() => logger.info("Azkar scheduler initialized successfully"))
    .catch((err) => logger.error("Azkar scheduler initialization failed:", err));

  // Schedule daily updates at midnight (12 AM)
  function scheduleNextUpdate() {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0); // Set to next midnight (12 AM)

    const timeUntilMidnight = nextMidnight - now;

    setTimeout(() => {
      initAzkarScheduler()
        .then(() => logger.info("Azkar scheduler initialized at 12 AM"))
        .catch((err) => logger.error("Azkar scheduler initialization failed:", err));

      // Schedule for the next day
      scheduleNextUpdate();
    }, timeUntilMidnight);
  }

  // Start the scheduling cycle
  scheduleNextUpdate();
  logger.info(`Server running on http://localhost:${PORT}`);
});
