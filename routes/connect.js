const express = require("express");
const router = express.Router();
const whatsappService = require("../services/whatsapp");
const telegramService = require("../services/telegram");
const logger = require("../utils/logger");

// Admin connect page
router.get("/", async (req, res) => {
  try {
    const whatsappStatus = whatsappService.getStatus();
    const qrCode = await whatsappService.getQrCode();
    const telegramToken = await telegramService.getToken();

    res.render("layout", {
      title: "Admin Connection Panel",
      content: "pages/connect",
      whatsapp: {
        isConnected: whatsappStatus.isConnected,
        status: whatsappStatus.status,
        qrCode: qrCode,
      },
      telegram: {
        hasToken: !!telegramToken,
        token: telegramToken ? "••••••••" : "",
      },
    });
  } catch (err) {
    logger.error("Error rendering connect page:", err);
    res.status(500).send("Error rendering connect page");
  }
});

// Save Telegram token
router.post("/telegram-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    // Validate token format (simple check)
    if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format",
      });
    }

    await telegramService.saveToken(token);
    logger.info("Telegram token saved successfully");

    res.json({
      success: true,
      message: "Telegram token saved successfully",
    });
  } catch (err) {
    logger.error("Error saving Telegram token:", err);
    res.status(500).json({
      success: false,
      message: "Error saving token: " + err.message,
    });
  }
});

// Get WhatsApp status
router.get("/whatsapp-status", async (req, res) => {
  try {
    const status = whatsappService.getStatus();
    const qrCode = await whatsappService.getQrCode();

    res.json({
      isConnected: status.isConnected,
      status: status.status,
      qrCode: qrCode,
    });
  } catch (err) {
    logger.error("Error getting WhatsApp status:", err);
    res.status(500).json({
      success: false,
      message: "Error getting WhatsApp status",
    });
  }
});

// Add a new route to refresh QR code
router.post("/refresh-qr", async (req, res) => {
  try {
    // Reset the QR code state
    await whatsappService.resetQR();
    res.json({
      success: true,
      message: "QR code refresh requested. Please wait for a new QR code.",
    });
  } catch (err) {
    logger.error("Error refreshing QR code:", err);
    res.status(500).json({
      success: false,
      message: "Error refreshing QR code: " + err.message,
    });
  }
});

module.exports = router;
