// models/prayerTime.js
const mongoose = require("mongoose");

const prayerTimeSchema = new mongoose.Schema({
  date: {
    type: String, // yyyy-mm-dd
    required: true,
    unique: true,
  },
  Fajr: String,
  Sunrise: String,
  Dhuhr: String,
  Asr: String,
  Maghrib: String,
  Sunset: String,
  Isha: String,
  Imsak: String,
  MidNight: String,
  Firstthird: String,
  Lastthird: String,
});

module.exports = mongoose.model("PrayerTime", prayerTimeSchema);
