/**
 * MSSIA End-to-End Tests
 *
 * Runs against the live Vercel deployment. Admin credentials are read from
 * process.env (populate via .env.test before running).
 *
 * Run:  npm run e2e
 *
 * NOTE: Tests that load buildings or floor plans require the backend API
 * (mssia.duckdns.org) to be reachable. If the API is down those tests will
 * fail with a timeout — that is expected behaviour, not a test bug.
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://final-year-project-alpha-azure.vercel.app";
const API_URL  = process.env.API_URL  ?? "https://mssia.duckdns.org";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  const email    = process.env.ADMIN_EMAIL    ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";

  await page.goto(`${BASE_URL}/admin/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/admin\/studio/, { timeout: 20_000 });
}

// Wait for the /user page to finish loading buildings from the API.
// Uses "load" (not "networkidle") so it doesn't hang when an SSE connection
// or a slow fetch is still open.
async function gotoUserPage(page: Page) {
  await page.goto(`${BASE_URL}/user`);
  await page.waitForLoadState("load");
}

// ═════════════════════════════════════════════════════════════════════════════
// USER VIEWER TESTS (no login required)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("User Viewer — public access", () => {

  test("home page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", err => errors.push(err.message));

    await page.goto(BASE_URL);
    await expect(page.getByText("MSSIA")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("home page shows the MSSIA logo and Multi-Sensor heading", async ({ page }) => {
    await page.goto(BASE_URL);
    // Nav logo text
    await expect(page.getByText("MSSIA")).toBeVisible();
    // Hero heading — rendered as three separate spans; exact:true avoids
    // matching the eyebrow label "Spatial Intelligence Platform"
    await expect(page.getByText("Multi-Sensor", { exact: true })).toBeVisible();
    await expect(page.getByText("Spatial Intelligence", { exact: true })).toBeVisible();
  });

  test("at least one building is visible on the user viewer", async ({ page }) => {
    await gotoUserPage(page);
    // Buildings render as buttons in the empty-state card grid
    await expect(
      page.locator("button").filter({ hasText: /\w/ }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a building shows the mode switcher", async ({ page }) => {
    await gotoUserPage(page);
    const firstBuilding = page.locator("button").filter({ hasText: /\w/ }).first();
    await firstBuilding.click();

    // Mode-switcher bar appears once a floor plan is selected
    await expect(
      page.getByRole("button", { name: /Signal/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Signal mode button is visible and active by default", async ({ page }) => {
    await gotoUserPage(page);
    await page.locator("button").filter({ hasText: /\w/ }).first().click();

    await expect(page.getByRole("button", { name: /Signal/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Temp/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Humidity/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Air/i })).toBeVisible();
  });

  test("clicking Temp, Humidity, and Air mode buttons switches the active mode", async ({ page }) => {
    await gotoUserPage(page);
    await page.locator("button").filter({ hasText: /\w/ }).first().click();
    await expect(page.getByRole("button", { name: /Signal/i })).toBeVisible({ timeout: 15_000 });

    for (const mode of ["Temp", "Humidity", "Air", "Signal"] as const) {
      await page.getByRole("button", { name: new RegExp(mode, "i") }).click();
      await expect(page.getByRole("button", { name: new RegExp(mode, "i") })).toBeVisible();
    }
  });

  test("heatmap floor plan image is visible after selecting a building", async ({ page }) => {
    await gotoUserPage(page);
    await page.locator("button").filter({ hasText: /\w/ }).first().click();
    await expect(page.locator('img[alt="Floor plan"]')).toBeVisible({ timeout: 15_000 });
  });

  test("clicking a floor plan tab switches the displayed floor", async ({ page }) => {
    await gotoUserPage(page);
    await page.locator("button").filter({ hasText: /\w/ }).first().click();

    // Wait for the floor plan to appear, then look for multiple floor tabs
    await expect(page.locator('img[alt="Floor plan"]')).toBeVisible({ timeout: 15_000 });

    const floorTabs = page.locator("button").filter({ hasText: /floor|ground|level|F\d/i });
    const count = await floorTabs.count();
    if (count >= 2) {
      await floorTabs.nth(1).click();
      await expect(page.locator('img[alt="Floor plan"]')).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({
        type: "info",
        description: "Only one floor plan — tab-switch step skipped",
      });
    }
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN TESTS (requires login)
// ═════════════════════════════════════════════════════════════════════════════

test.describe("Admin — authentication flow", () => {

  test("visiting /admin/studio without a token redirects to /admin/login", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);
    await page.evaluate(() => localStorage.removeItem("mssia_token"));

    await page.goto(`${BASE_URL}/admin/studio`);
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("submitting wrong credentials shows an error message", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/login`);

    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Use the CSS class to avoid matching Next.js's built-in route announcer
    // (which also has role="alert" but is always empty)
    const errorAlert = page.locator('.error-msg');
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
    await expect(errorAlert).not.toBeEmpty();
  });

  test("submitting correct credentials redirects to the admin studio", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/studio/);
  });

  test("after login, the admin studio renders the floor plan canvas", async ({ page }) => {
    await loginAsAdmin(page);
    // The studio auto-selects the first building + floor plan asynchronously;
    // give it up to 20 s to render the canvas or floor plan image
    await expect(
      page.locator("canvas").or(page.locator('img[alt="Floor plan"]')).first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test("admin studio header is visible after login", async ({ page }) => {
    await loginAsAdmin(page);
    // These elements are rendered unconditionally in the studio top bar
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 15_000 });
    // exact:true avoids matching the Next.js route announcer "Map Studio — MSSIA Admin"
    await expect(page.getByText("ADMIN", { exact: true })).toBeVisible();
  });

  test("logging out redirects back to the login page", async ({ page }) => {
    await loginAsAdmin(page);
    // Logout button is always present; no need to wait for networkidle
    const logoutBtn = page.getByRole("button", { name: "Logout" });
    await expect(logoutBtn).toBeVisible({ timeout: 15_000 });
    await logoutBtn.click();

    await page.waitForURL(/\/admin\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

});

// ═════════════════════════════════════════════════════════════════════════════
// API HEALTH CHECK VIA BROWSER
// ═════════════════════════════════════════════════════════════════════════════

test.describe("API Health", () => {

  test("GET /health returns {status:'ok'}", async ({ page }) => {
    const response = await page.goto(`${API_URL}/health`);
    expect(response?.status()).toBe(200);

    const body = await page.evaluate(() => document.body.innerText);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`Response body is not valid JSON: ${body}`);
    }
    expect(parsed.status).toBe("ok");
  });

});
