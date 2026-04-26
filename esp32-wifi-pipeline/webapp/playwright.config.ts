import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.test so process.env values are available in the config itself
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 1,
  workers: 1,

  use: {
    baseURL: process.env.BASE_URL ?? "https://final-year-project-alpha-azure.vercel.app",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    headless: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  reporter: [["list"], ["html", { open: "never" }]],
});
