const Zekr = require("../models/azkar");
const PrayerTime = require("../models/prayerTime");
const fetch = require("node-fetch");
const logger = require("../utils/logger");
const { scheduleMessage } = require("./scheduler");

async function getPrayerTimes(city, country) {
  try {
    const response = await fetch(
      `https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=5&shafaq=general&timezonestring=Africa%2FCairo&calendarMethod=UAQ`
    );
    const data = await response.json();

    if (data.code === 200) {
      return {
        date: data.data.date.gregorian.date,
        timings: data.data.timings,
      };
    } else {
      throw new Error(data.status);
    }
  } catch (error) {
    logger.error("Error fetching prayer times:", error);
    console.error(error);
    throw error;
  }
}

async function initAzkarScheduler() {
  const city = "Damietta";
  const country = "Egypt";

  try {
    const { date, timings } = await getPrayerTimes(city, country);

    // Save prayer times
    await PrayerTime.findOneAndUpdate({ date }, { date, ...timings }, { upsert: true, new: true });

    // Fetch Azkar
    const [azkarContentMorning, azkarContentEvening] = await Promise.all([
      Zekr.find({ type: "morning" }),
      Zekr.find({ type: "evening" }),
    ]);

    const common = {
      platforms: ["whatsapp", "telegram"],
      channels: ["67fa348903321acb56714506"],
    };

    const azkar = {
      morning: {
        content: azkarContentMorning.map((z) => z.text).join(", "),
        ...common,
      },
      evening: {
        content: azkarContentEvening.map((z) => z.text).join(", "),
        ...common,
      },
    };

    const [sunH, sunM] = timings.Sunrise.split(":");
    const [setH, setM] = timings.Sunset.split(":");

    const today = new Date();
    const sunriseDate = new Date(today.setHours(parseInt(sunH), parseInt(sunM), 0));
    const sunsetDate = new Date(today.setHours(parseInt(setH), parseInt(setM), 0));

    await scheduleMessage({
      content: azkar.morning.content, // فقط النص
      platforms: azkar.morning.platforms,
      channels: azkar.morning.channels, // لازم تكون [String] أو [ObjectId] حسب الـ schema
      scheduledTime: sunriseDate,
    });

    await scheduleMessage({
      content: azkar.evening.content,
      platforms: azkar.evening.platforms,
      channels: azkar.evening.channels, // لازم تكون [String] أو [ObjectId] حسب الـ schema
      scheduledTime: sunsetDate,
    });

    logger.info("Azkar scheduled successfully.");
  } catch (error) {
    logger.error("Error in initAzkarScheduler:", error.message);
  }
}

module.exports = initAzkarScheduler;
/**
 * Creates a new zekr in the database
 * @param {string} text - The content of the zekr
 * @param {string} type - The type of zekr (morning/evening)
 * @param {Object} [options] - Optional additional fields
 * @returns {Promise<Object>} The created zekr object
 */
async function createZekr(text, type, options = {}) {
  try {
    if (!text || !type) {
      throw new Error("Text and type are required");
    }

    if (!["morning", "evening"].includes(type)) {
      throw new Error("Type must be either 'morning' or 'evening'");
    }

    const zekr = new Zekr({
      text,
      type,
      ...options,
    });

    await zekr.save();
    logger.info(`New zekr created: ${text.substring(0, 20)}...`);
    return zekr;
  } catch (error) {
    logger.error("Error creating zekr:", error);
    throw error;
  }
}
// createZekr("Azkra morning", "morning", { additionalField: "value" })
//   .then((zekr) => console.log("Zekr created:", zekr))
//   .catch((error) => console.error("Error creating zekr:", error));

// createZekr("Azkra evening", "evening", { additionalField: "value" })
//   .then((zekr) => console.log("Zekr created:", zekr))
//   .catch((error) => console.error("Error creating zekr:", error));

module.exports = {
  initAzkarScheduler,
  createZekr,
  getPrayerTimes,
};
