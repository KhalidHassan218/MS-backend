// services/pdf/browserPool.js
import { chromium, puppeteer } from "../../config/puppeteer.js";

class BrowserPool {
  constructor(maxBrowsers = 1) { // Start with 1 browser only
    this.maxBrowsers = maxBrowsers;
    this.browsers = [];
    this.available = [];
    this.queue = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    console.log("🔄 Initializing browser pool...");
    
    // Try to launch just one browser first
    try {
      const browser = await this.launchBrowser();
      this.browsers.push(browser);
      this.available.push(browser);
      this.initialized = true;
      console.log("✅ Browser pool initialized with 1 browser");
    } catch (error) {
      console.error("❌ Failed to initialize browser pool:", error.message);
      throw error;
    }
  }

  async launchBrowser() {
    console.log("🚀 Launching browser...");
    
    // Try different configurations
    const launchOptions = {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
        "--disable-features=VizDisplayCompositor",
        "--disable-accelerated-2d-canvas",
        "--disable-accelerated-mjpeg-decode",
        "--disable-accelerated-video-decode",
        "--disable-webgl",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-ipc-flooding-protection",
        "--disable-client-side-phishing-detection",
        "--disable-hang-monitor",
        "--disable-sync",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-translate",
        "--disable-features=TranslateUI",
        "--disable-component-update",
        "--disable-breakpad",
        "--disable-logging",
        "--disable-device-discovery-notifications",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--no-first-run",
        "--mute-audio",
        "--no-default-browser-check",
        "--autoplay-policy=user-gesture-required",
      ],
      headless: "new", // Use new headless mode
      ignoreHTTPSErrors: true,
      timeout: 60000, // 60 second timeout
    };

    // Add Chromium executable path if available
    try {
      const execPath = await chromium.executablePath();
      if (execPath) {
        launchOptions.executablePath = execPath;
        console.log("Using Chromium executable:", execPath);
      } else {
        // Fallback to puppeteer's bundled Chrome
        console.log("Using default Chrome/Chromium");
      }
    } catch (execError) {
      console.warn("Could not get Chromium executable path:", execError.message);
    }

    console.log("Launch options:", launchOptions.args.slice(0, 5), "...");
    
    const browser = await puppeteer.launch(launchOptions);
    
    // Test browser
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.close();
    
    console.log("✅ Browser launched successfully");
    return browser;
  }

  async acquire() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.available.length > 0) {
      const browser = this.available.pop();
      console.log(`📝 Browser acquired (${this.available.length} remaining)`);
      return browser;
    }

    console.log("⏳ All browsers busy, waiting...");
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(browser) {
    this.available.push(browser);
    console.log(`🔄 Browser released (${this.available.length} available)`);
    
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve(browser);
    }
  }

  async cleanup() {
    console.log("🧹 Cleaning up browser pool...");
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error.message);
      }
    }
    this.browsers = [];
    this.available = [];
    this.initialized = false;
  }
}

// Create singleton instance
const browserPool = new BrowserPool();

// Clean up on exit
process.on('SIGTERM', async () => {
  await browserPool.cleanup();
});

process.on('SIGINT', async () => {
  await browserPool.cleanup();
  process.exit(0);
});

export default browserPool;