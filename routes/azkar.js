const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const Zekr = require("../models/azkar");
const PrayerTime = require("../models/prayerTime");

router.get("/azkar", async (req, res) => {
  try {
    res.render("layout", {
      title: "azkar management",
      content: "pages/azkarContent",
    });
  } catch (err) {
    logger.error("Error rendering connect page:", err);
    res.status(500).send("Error rendering connect page");
  }
});

router.get("/azkar/:zekrType", async (req, res) => {
  const zekrType = req.params.zekrType;
  if (!["morning", "evening"].includes(zekrType)) {
    return res.status(400).send("Invalid zekr type");
  }
  try {
    const azkar = await Zekr.find({ type: zekrType });
    return res.status(200).json(azkar.map((z) => z.text)[0]); // أو رجع الـ object كامل لو حابب
  } catch (err) {
    logger.error("Error fetching azkar:", err);
    res.status(500).send("Error fetching azkar");
  }
});

router.get("/praying-timings", async (req, res) => {
  try {
    const timings = await PrayerTime.find({});
    if (!timings.length) {
      return res.status(404).send("No praying timings found");
    }
    res.status(200).json(timings[0]);
  } catch (err) {
    logger.error("Error rendering praying timings page:", err);
    res.status(500).send("Error rendering praying timings page");
  }
});

router.post("/azkar/edit/:currentAzkarType", async (req, res) => {
  const currentAzkarType = req.params.currentAzkarType;
  const { content } = req.body;
  if (!["morning", "evening"].includes(currentAzkarType)) {
    console.error("Invalid zekr type:", currentAzkarType);
    return res.status(400).send("Invalid zekr type");
  }
  try {
    const azkar = await Zekr.findOneAndUpdate(
      { type: currentAzkarType },
      { text: content },
      { new: true, upsert: true }
    );
    return res.status(200).json({ success: true, azkar });
  } catch (err) {
    logger.error("Error updating azkar:", err);
    res.status(500).send("Error updating azkar");
  }
});
module.exports = router;
