const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");
const Channel = require("../models/channel");
const puppeteer = require("puppeteer");

// Service state
let qrData = null;
let isConnected = false;
let status = "initializing";
let browser = null;
let page = null;
let qrTimeout = null;
const QR_TIMEOUT_DURATION = 60000; // 60 seconds timeout for QR code

/**
 * WhatsApp client with local authentication
 */
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, "../data/whatsapp-session"),
  }),
  puppeteer: {
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// Handle QR code event
client.on("qr", async (qr) => {
  logger.info("WhatsApp QR code received");
  qrData = qr;
  status = "qr_received";

  // Clear any existing timeout
  if (qrTimeout) clearTimeout(qrTimeout);

  // Set a new timeout to invalidate the QR code after some time
  qrTimeout = setTimeout(() => {
    if (status === "qr_received") {
      logger.info("QR code expired");
      status = "qr_expired";
      // Don't clear qrData so the frontend can show it as expired
    }
  }, QR_TIMEOUT_DURATION);
});

// Handle ready event
client.on("ready", () => {
  logger.info("WhatsApp client is ready");
  // scrapeChannels();
  isConnected = true;
  status = "authenticated";
  qrData = null;

  // Store references to pupBrowser and pupPage
  try {
    client.pupBrowser = client.pupBrowser || client.page.browser();
    client.pupPage = client.pupPage || client.page;

    logger.info("Puppeteer browser and page references stored successfully");
  } catch (error) {
    logger.error("Error accessing Puppeteer instances:", error);
  }
});

// Handle authenticated event
client.on("authenticated", (session) => {
  logger.info("WhatsApp authentication successful");
  isConnected = true;
  status = "authenticated";
});

// Handle auth failure event
client.on("auth_failure", (error) => {
  logger.error("WhatsApp authentication failed:", error);
  isConnected = false;
  status = "auth_failure";
});

// Handle disconnected event
client.on("disconnected", (reason) => {
  logger.warn(`WhatsApp disconnected: ${reason}`);
  isConnected = false;
  status = "disconnected";
});

/**
 * Initialize the WhatsApp client
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    logger.info("Initializing WhatsApp client...");
    await client.initialize();
    return true;
  } catch (error) {
    logger.error("Failed to initialize WhatsApp client:", error);
    status = "error";
    throw error;
  }
}

/**
 * Get current WhatsApp connection status
 * @returns {Object} Status object
 */
function getStatus() {
  return {
    isConnected,
    status,
    hasQr: !!qrData,
  };
}

/**
 * Get QR code data URL if available
 * @returns {Promise<string|null>} QR code data URL or null
 */
async function getQrCode() {
  if (!qrData) return null;

  try {
    return await qrcode.toDataURL(qrData);
  } catch (error) {
    logger.error("Error generating QR code:", error);
    return null;
  }
}

/**
 * Reset QR code state to force new QR generation
 * @returns {Promise<void>}
 */
async function resetQR() {
  logger.info("Resetting QR code");

  // Clear the current QR data and status
  qrData = null;
  status = "initializing";
  if (qrTimeout) {
    clearTimeout(qrTimeout);
    qrTimeout = null;
  }

  // Request a new QR code by refreshing the session
  try {
    await client.resetState();
    logger.info("WhatsApp state reset, new QR code will be generated");
    return true;
  } catch (error) {
    logger.error("Failed to reset WhatsApp state:", error);
    throw error;
  }
}

/**
 * Scrape WhatsApp channels where user is admin
 * @returns {Promise<Array>} List of channels
 */
async function scrapeChannels() {
  if (!isConnected) {
    throw new Error("WhatsApp is not connected");
  }

  logger.info("Starting WhatsApp channel scraping");

  try {
    // Use the authenticated client from whatsapp-web.js
    const puppeteerBrowser = client.pupBrowser;
    const puppeteerPage = client.pupPage;

    if (!puppeteerBrowser || !puppeteerPage) {
      throw new Error("WhatsApp browser instance not available");
    }

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, "../data/debug-screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Capture screenshot of initial state
    await puppeteerPage.screenshot({
      path: path.join(screenshotsDir, "before-scraping.png"),
      fullPage: true,
    });
    logger.info("Initial state screenshot captured");

    // Store the current URL before navigating
    const currentUrl = await puppeteerPage.url();
    logger.info(`Current page URL: ${currentUrl}`);

    // Debug: Get the page title
    const pageTitle = await puppeteerPage.title();
    logger.info(`Page title: ${pageTitle}`);

    // Click on Channels tab
    logger.info("Attempting to click on Channels tab");
    const channelsTabExists = await puppeteerPage.evaluate(() => {
      const channelsTab = document.querySelector('button[aria-label="Channels"]');
      if (channelsTab) {
        console.log("Channels tab found:", channelsTab);
        channelsTab.click();
        return true;
      }
      return false;
    });

    if (!channelsTabExists) {
      logger.warn("Channels tab not found on the page");
      await puppeteerPage.screenshot({
        path: path.join(screenshotsDir, "no-channels-tab.png"),
        fullPage: true,
      });
    } else {
      logger.info("Channels tab found and clicked");
    }

    // Wait a moment for any animations
    await puppeteerPage.waitForTimeout(2000);

    // Capture screenshot after clicking the channels tab
    await puppeteerPage.screenshot({
      path: path.join(screenshotsDir, "after-channels-click.png"),
      fullPage: true,
    });

    // Wait for the sidebar containing channels to appear
    logger.info("Waiting for channel list sidebar to appear");
    try {
      await puppeteerPage.waitForSelector('button[aria-label="Channel list"]', { timeout: 10000 });
      logger.info("Channel list sidebar detected");
    } catch (error) {
      logger.warn(`Channel list sidebar not found: ${error.message}`);

      // Try alternative selector for channel list
      try {
        await puppeteerPage.waitForSelector('div[aria-label="Channel list"]', { timeout: 5000 });
        logger.info("Channel list container found with alternative selector");
      } catch (altError) {
        logger.error(`Alternative channel list selector also failed: ${altError.message}`);
        await puppeteerPage.screenshot({
          path: path.join(screenshotsDir, "no-channel-list.png"),
          fullPage: true,
        });
      }
    }

    await puppeteerPage.waitForTimeout(2000);

    logger.info("Beginning channel extraction");

    // Get channels with the specified approach
    const channels = await puppeteerPage.evaluate(async () => {
      console.log("Starting channel evaluation with revised approach");
      const channelList = [];

      // Find the channel list container
      const channelListContainer =
        document.querySelector('button[aria-label="Channel list"]') ||
        document.querySelector('div[aria-label="Channel list"]');

      if (!channelListContainer) {
        console.log("Channel list container not found");

        // Log all available aria-labels for debugging
        const allAriaLabels = Array.from(document.querySelectorAll("[aria-label]")).map((el) =>
          el.getAttribute("aria-label")
        );
        console.log("Available aria-labels:", allAriaLabels);

        return [];
      }

      console.log("Channel list container found:", channelListContainer);

      // Find all channel items - we'll check different approaches
      let channelItems = [];

      // Use the specific selector provided to get channel elements
      const channelSpans = document.querySelectorAll(
        'div[aria-label="Channel list"] span.x1c4vz4f.x3nfvp2.xuce83p.x1bft6iq.x1i7k8ik.xq9mrsl.x6s0dn4 span[title]'
      );
      console.log(`Found ${channelSpans.length} channel spans with the specific selector`);

      // Process each channel
      for (let i = 0; i < channelSpans.length; i++) {
        try {
          // Get channel name from the title attribute
          const channelName = channelSpans[i].title;
          console.log(`Processing channel ${i + 1}/${channelSpans.length}: ${channelName}`);

          if (!channelName) {
            console.log("No channel name found, skipping");
            continue;
          }

          // Click on the channel to open it
          console.log(`Clicking on channel: ${channelName}`);
          channelSpans[i].click();

          // Wait for channel to load
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Check if input exists (indicating user is admin)
          const inputBox = document.querySelector('div[aria-label="Type an update"]');
          const isAdmin = !!inputBox;
          console.log(`Channel "${channelName}" - Is Admin: ${isAdmin}`);

          // Add to our list
          channelList.push({
            name: channelName,
            isAdmin: isAdmin,
            index: i + 1, // Store 1-based index for debugging
          });

          // Go back to channels list
          const backButton = document.querySelector('button[aria-label="Back"]');
          if (backButton) {
            backButton.click();
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            console.log("Back button not found, trying to navigate back to channel list");
            // Try to click the channels tab again to return
            const channelsTab = document.querySelector('button[aria-label="Channels"]');
            if (channelsTab) {
              channelsTab.click();
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
        } catch (err) {
          console.error(`Error processing channel ${i + 1}:`, err);
        }
      }

      console.log(`Channel evaluation complete. Found ${channelList.length} channels`);
      return channelList;
    });

    // Capture final state
    await puppeteerPage.screenshot({
      path: path.join(screenshotsDir, "after-scraping.png"),
      fullPage: true,
    });

    logger.info(`Found ${channels.length} WhatsApp channels`);

    // Save channels to database with better error handling and validation
    const savedChannels = [];
    for (const channel of channels) {
      try {
        logger.info(`Saving channel to database: ${channel.name} (isAdmin: ${channel.isAdmin})`);

        const savedChannel = await Channel.findOneAndUpdate(
          { name: channel.name, platform: "whatsapp" },
          {
            name: channel.name,
            platform: "whatsapp",
            isAdmin: channel.isAdmin,
            lastUpdated: new Date(),
          },
          { upsert: true, new: true, runValidators: true }
        );

        if (savedChannel) {
          logger.info(`Successfully saved channel: ${savedChannel.name} (ID: ${savedChannel._id})`);
          savedChannels.push(savedChannel);
        } else {
          logger.error(`Failed to save channel ${channel.name} - no document returned`);
        }
      } catch (dbError) {
        logger.error(`Database error saving channel ${channel.name}:`, dbError);
      }
    }

    // Verify channels were saved by querying the database
    try {
      const storedChannels = await Channel.find({ platform: "whatsapp" });
      logger.info(`Verification - Found ${storedChannels.length} channels in database`);

      // Verify admin channels
      const adminChannels = storedChannels.filter((ch) => ch.isAdmin === true);
      logger.info(`Found ${adminChannels.length} admin channels: ${adminChannels.map((ch) => ch.name).join(", ")}`);

      if (storedChannels.length === 0 && channels.length > 0) {
        logger.warn("No channels found in database despite attempting to save them");
      }
    } catch (verifyError) {
      logger.error("Error verifying stored channels:", verifyError);
    }

    // Return to the original URL if needed
    if (currentUrl && currentUrl !== (await puppeteerPage.url())) {
      await puppeteerPage.goto(currentUrl);
    }

    return channels;
  } catch (error) {
    logger.error("Error scraping WhatsApp channels:", error);
    throw error;
  }
}

/**
 * Send a message to WhatsApp channels
 * @param {string} message - Message content
 * @param {Array} channels - Channel names to send to
 * @returns {Promise<Array>} Results of sending
 */
async function sendChannelMessages(message, channels) {
  if (!isConnected) {
    throw new Error("WhatsApp is not connected");
  }

  logger.info(`Sending message to ${channels.length} WhatsApp channels`);

  const results = [];

  try {
    // Use the authenticated client from whatsapp-web.js
    const puppeteerBrowser = client.pupBrowser;
    const puppeteerPage = client.pupPage;

    if (!puppeteerBrowser || !puppeteerPage) {
      throw new Error("WhatsApp browser instance not available");
    }

    // Store the current URL before navigating
    const currentUrl = await puppeteerPage.url();

    // Click on Channels tab - more robust method
    await puppeteerPage.evaluate(() => {
      // Try multiple selectors to find the channels tab
      const channelsTab =
        document.querySelector('button[aria-label="Channels"]') ||
        document.querySelector('div[aria-label="Channels"]') ||
        document.querySelector('[data-icon="channels"]');

      if (channelsTab) {
        console.log("Found channels tab:", channelsTab);
        channelsTab.click();
        return true;
      } else {
        console.warn("Channels tab not found!");
        // Log all aria-labels for debugging
        console.log(
          "Available aria-labels:",
          Array.from(document.querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label"))
        );
        return false;
      }
    });

    // Capture screenshot for debugging
    const debugScreenshotsDir = path.join(__dirname, "../data/debug-screenshots");
    if (!fs.existsSync(debugScreenshotsDir)) {
      fs.mkdirSync(debugScreenshotsDir, { recursive: true });
    }

    await puppeteerPage.screenshot({
      path: path.join(debugScreenshotsDir, "before-sending.png"),
      fullPage: true,
    });

    // Wait for channels to load with better error handling
    logger.info("Waiting for channel list to load");
    try {
      await puppeteerPage.waitForSelector('div[aria-label="Channel list"]', { timeout: 10000 });
      logger.info("Channel list found");
    } catch (selectorError) {
      logger.warn(`Channel list selector not found: ${selectorError.message}`);

      // Take a screenshot of the current state for debugging
      await puppeteerPage.screenshot({
        path: path.join(debugScreenshotsDir, "channel-list-not-found.png"),
        fullPage: true,
      });

      // Try to continue anyway
    }

    await puppeteerPage.waitForTimeout(2000);

    // Get all available channels for debugging
    const availableChannels = await puppeteerPage.evaluate(() => {
      const channelElements = document.querySelectorAll(
        'div[aria-label="Channel list"] span.x1c4vz4f.x3nfvp2.xuce83p.x1bft6iq.x1i7k8ik.xq9mrsl.x6s0dn4'
      );
      return Array.from(channelElements).map((el) => el.getAttribute("title"));
    });

    logger.info(`Available channels in UI: ${availableChannels.join(", ")}`);

    // Send message to each channel
    for (const channelName of channels) {
      try {
        logger.info(`Attempting to send message to channel: ${channelName}`);

        // Take screenshot before sending to each channel
        await puppeteerPage.screenshot({
          path: path.join(debugScreenshotsDir, `before-sending-to-${channelName.replace(/[^a-zA-Z0-9]/g, "_")}.png`),
          fullPage: true,
        });

        // More robust channel selection with verification
        const channelResult = await puppeteerPage.evaluate(async (targetChannelName) => {
          console.log(`Looking for channel: "${targetChannelName}"`);

          // Find all channel elements that might match
          const allTitles = document.querySelectorAll("span[title]");
          console.log(`Found ${allTitles.length} elements with title attributes`);

          let channelElement = null;
          let exactMatch = false;

          // First try exact match
          for (const el of allTitles) {
            const title = el.getAttribute("title");
            console.log(`Checking element with title: "${title}"`);

            if (title === targetChannelName) {
              channelElement = el;
              exactMatch = true;
              console.log(`Found exact match for "${targetChannelName}"`);
              break;
            }
          }

          // If no exact match, try case-insensitive match
          if (!channelElement) {
            for (const el of allTitles) {
              const title = el.getAttribute("title");
              if (title && title.toLowerCase() === targetChannelName.toLowerCase()) {
                channelElement = el;
                console.log(`Found case-insensitive match for "${targetChannelName}": "${title}"`);
                break;
              }
            }
          }

          if (!channelElement) {
            console.error(`Channel "${targetChannelName}" not found in the list`);
            return {
              channel: targetChannelName,
              status: "failed",
              error: "Channel not found in the list",
              availableChannels: Array.from(allTitles).map((el) => el.getAttribute("title")),
            };
          }

          // Click on the channel element
          console.log(`Clicking on channel: "${targetChannelName}"`);
          channelElement.click();

          // Wait for channel to load
          await new Promise((resolve) => setTimeout(resolve, 2000));

          // Verify we're in the right channel
          const channelHeader = document.querySelector(
            "header.x1n2onr6.xfo81ep.x9f619.x78zum5.x6s0dn4.xh8yej3 span.x1iyjqo2.x6ikm8r.x10wlt62.x1n2onr6"
          );
          const loadedChannelName = channelHeader ? channelHeader.textContent : null;

          console.log(`Channel header shows: "${loadedChannelName}"`);

          // if (
          //   !loadedChannelName ||
          //   (exactMatch && loadedChannelName !== targetChannelName) ||
          //   (!exactMatch && loadedChannelName.toLowerCase() !== targetChannelName.toLowerCase())
          // ) {
          //   console.error(`Wrong channel loaded. Expected: "${targetChannelName}", Got: "${loadedChannelName}"`);
          //   return {
          //     channel: targetChannelName,
          //     status: "failed",
          //     error: `Wrong channel loaded. Expected: "${targetChannelName}", Got: "${loadedChannelName}"`,
          //     loadedChannel: loadedChannelName,
          //   };
          // }

          // Check if input exists (user is admin)
          const inputBox = document.querySelector('div[aria-label="Type an update"]');
          if (!inputBox) {
            console.error(`Not an admin in channel "${targetChannelName}"`);
            return {
              channel: targetChannelName,
              status: "failed",
              error: "Not an admin in this channel",
              loadedChannel: loadedChannelName,
            };
          }

          return { channelVerified: true, loadedChannel: loadedChannelName };
        }, channelName);

        // If channel verification failed, record the error and continue
        if (!channelResult.channelVerified) {
          logger.error(`Failed to verify channel "${channelName}": ${channelResult.error}`);
          results.push({
            channel: channelName,
            status: "failed",
            error: channelResult.error || "Channel verification failed",
            platform: "whatsapp",
            timestamp: new Date(),
          });
          continue;
        }

        logger.info(`Successfully verified channel: ${channelResult.loadedChannel}`);

        // Now that we're in the right channel, send the message
        const sendResult = await puppeteerPage.evaluate(async (msg) => {
          try {
            // Type message
            const inputBox = document.querySelector('div[aria-label="Type an update"]');
            if (!inputBox) {
              return {
                status: "failed",
                error: "Input box not found",
              };
            }

            // Clear any existing text
            // Focus the input box
            inputBox.focus();

            // Clear any existing content
            inputBox.innerHTML = "";

            try {
              // Method 1: Using execCommand (works better for contentEditable elements)
              document.execCommand("selectAll");
              document.execCommand("insertText", false, msg);
            } catch (e) {
              console.log("execCommand method failed:", e);

              try {
                // Method 2: Use Selection API
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(inputBox);
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand("insertText", false, msg);
              } catch (e2) {
                console.log("Selection API method failed:", e2);

                // Method 3: Simulate keyboard input
                const setText = (text) => {
                  const dataTransfer = new DataTransfer();
                  dataTransfer.setData("text", text);
                  inputBox.dispatchEvent(
                    new ClipboardEvent("paste", {
                      clipboardData: dataTransfer,
                      bubbles: true,
                    })
                  );
                };
                setText(msg);
              }
            }

            // Ensure input change is registered
            inputBox.dispatchEvent(new Event("input", { bubbles: true }));

            // Wait for send button to be enabled
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Find send button - try multiple selectors
            const sendButton =
              document.querySelector('button[data-tab="11"]') ||
              document.querySelector('button[data-icon="send"]') ||
              document.querySelector('button[aria-label="Send"]');

            if (!sendButton) {
              return {
                status: "failed",
                error: "Send button not found",
              };
            }

            // Click send button
            sendButton.click();

            // Wait a moment to ensure the message sends
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Try to verify the message was sent by looking for it in the chat
            const sentMessages = document.querySelectorAll("div.message-out");
            const lastMessage = sentMessages[sentMessages.length - 1];
            const messageText = lastMessage ? lastMessage.textContent : null;

            const verified = messageText && messageText.includes(msg);

            return {
              status: "success",
              verified: verified,
              error: null,
            };
          } catch (err) {
            return {
              status: "failed",
              error: err.message || "Error sending message",
            };
          }
        }, message);

        // Take screenshot after sending
        await puppeteerPage.screenshot({
          path: path.join(debugScreenshotsDir, `after-sending-to-${channelName.replace(/[^a-zA-Z0-9]/g, "_")}.png`),
          fullPage: true,
        });

        results.push({
          channel: channelName,
          loadedChannel: channelResult.loadedChannel,
          status: sendResult.status,
          verified: sendResult.verified,
          error: sendResult.error,
          platform: "whatsapp",
          timestamp: new Date(),
        });

        logger.info(`Message sent to ${channelName}: ${sendResult.status} ${sendResult.verified ? "(verified)" : ""}`);

        // Random delay between messages (3-10 seconds)
        const delay = Math.floor(Math.random() * 7000) + 3000;
        await puppeteerPage.waitForTimeout(delay);
      } catch (error) {
        logger.error(`Error sending to channel ${channelName}:`, error);
        results.push({
          channel: channelName,
          platform: "whatsapp",
          status: "failed",
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    // Return to the original URL if needed
    if (currentUrl && currentUrl !== (await puppeteerPage.url())) {
      await puppeteerPage.goto(currentUrl);
    }

    return results;
  } catch (error) {
    logger.error("Error sending WhatsApp channel messages:", error);
    throw error;
  }
}

process.on("exit", async () => {
  if (browser) await browser.close();
});

module.exports = {
  initialize,
  getStatus,
  getQrCode,
  scrapeChannels,
  sendChannelMessages,
  resetQR,
  client,
};
