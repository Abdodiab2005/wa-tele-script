const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");

// Home page route
router.get("/", (req, res) => {
  try {
    res.render("layout", {
      title: "WhatsApp & Telegram Auth System",
      content: "pages/index",
    });
  } catch (err) {
    logger.error("Error rendering index page:", err);
    res.status(500).send("Error rendering page");
  }
});

module.exports = router;
