// api.test.ts
// MSSIA Platform – Frontend API Function Tests (Jest)
//
// Run locally:
//   npx jest
//
// Run vs cloud:
//   NEXT_PUBLIC_API_URL=https://mssia.duckdns.org npx jest

import { describe, it, expect, beforeAll } from "@jest/globals";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

console.log(`\nRunning MSSIA Frontend Tests against: ${BASE_URL}\n`);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@mssia.ie", password: "admin123" }),
  });
  const data = await res.json();
  return data.access_token;
}

// ── Health ────────────────────────────────────────────────────────────────────
describe("GET /health", () => {
  it("returns 200 status", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
  });

  it("returns {status: ok}", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
describe("POST /auth/login", () => {
  it("returns 200 with valid credentials", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@mssia.ie", password: "admin123" }),
    });
    expect(res.status).toBe(200);
  });

  it("returns access_token in response", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@mssia.ie", password: "admin123" }),
    });
    const data = await res.json();
    expect(data).toHaveProperty("access_token");
    expect(typeof data.access_token).toBe("string");
    expect(data.access_token.length).toBeGreaterThan(20);
  });

  it("returns token_type: bearer", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@mssia.ie", password: "admin123" }),
    });
    const data = await res.json();
    expect(data.token_type).toBe("bearer");
  });

  it("returns 401 with wrong password", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@mssia.ie", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 with unknown email", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@test.com", password: "admin123" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/verify", () => {
  let token: string;
  beforeAll(async () => { token = await getToken(); });

  it("returns 200 with valid Bearer token", async () => {
    const res = await fetch(`${BASE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("returns valid: true with valid token", async () => {
    const res = await fetch(`${BASE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it("returns 401 with no token", async () => {
    const res = await fetch(`${BASE_URL}/auth/verify`);
    expect(res.status).toBe(401);
  });

  it("returns 401 with fake token", async () => {
    const res = await fetch(`${BASE_URL}/auth/verify`, {
      headers: { Authorization: "Bearer faketoken123" },
    });
    expect(res.status).toBe(401);
  });
});

// ── Ingest ────────────────────────────────────────────────────────────────────
describe("POST /ingest", () => {
  it("returns 403 for unknown node", async () => {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node: "FAKE-NODE-999",
        scans: [{ ssid: "Test", bssid: "aa:bb:cc:dd:ee:ff", rssi: -65, channel: 6, enc: 4 }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when node field is missing", async () => {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scans: [{ ssid: "Test", rssi: -65 }],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when scans array is empty", async () => {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node: "ESP32-LAB-01", scans: [] }),
    });
    expect(res.status).toBe(400);
  });
});

// ── Buildings ─────────────────────────────────────────────────────────────────
describe("GET /buildings", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/buildings`);
    expect(res.status).toBe(200);
  });

  it("returns buildings array", async () => {
    const res = await fetch(`${BASE_URL}/buildings`);
    const data = await res.json();
    expect(data).toHaveProperty("buildings");
    expect(Array.isArray(data.buildings)).toBe(true);
  });

  it("each building has id, name fields", async () => {
    const res = await fetch(`${BASE_URL}/buildings`);
    const data = await res.json();
    if (data.buildings.length > 0) {
      const b = data.buildings[0];
      expect(b).toHaveProperty("id");
      expect(b).toHaveProperty("name");
    }
  });

  it("returns 404 for non-existent building", async () => {
    const res = await fetch(`${BASE_URL}/buildings/99999`);
    expect(res.status).toBe(404);
  });
});

// ── Devices ───────────────────────────────────────────────────────────────────
describe("GET /devices", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/devices`);
    expect(res.status).toBe(200);
  });

  it("returns devices array", async () => {
    const res = await fetch(`${BASE_URL}/devices`);
    const data = await res.json();
    expect(data).toHaveProperty("devices");
    expect(Array.isArray(data.devices)).toBe(true);
  });
});

describe("GET /devices/known", () => {
  it("returns 200", async () => {
    const res = await fetch(`${BASE_URL}/devices/known`);
    expect(res.status).toBe(200);
  });

  it("returns nodes array", async () => {
    const res = await fetch(`${BASE_URL}/devices/known`);
    const data = await res.json();
    expect(data).toHaveProperty("nodes");
    expect(Array.isArray(data.nodes)).toBe(true);
  });
});

// ── Wifi History ──────────────────────────────────────────────────────────────
describe("GET /scan-points/{id}/wifi-history", () => {
  it("returns 404 for non-existent scan point", async () => {
    const res = await fetch(`${BASE_URL}/scan-points/99999/wifi-history`);
    expect(res.status).toBe(404);
  });

  it("returns 422 for invalid time_range", async () => {
    const res = await fetch(`${BASE_URL}/scan-points/1/wifi-history?time_range=invalid`);
    expect(res.status).toBe(422);
  });

  it("accepts all valid time_range values", async () => {
    for (const range of ["20m", "1h", "6h", "24h", "7d"]) {
      const res = await fetch(`${BASE_URL}/scan-points/1/wifi-history?time_range=${range}`);
      expect([200, 404]).toContain(res.status);
    }
  });
});

// ── Heatmap ───────────────────────────────────────────────────────────────────
describe("GET /heatmap/floorplan/{id}", () => {
  it("returns 404 for non-existent floor plan", async () => {
    const res = await fetch(`${BASE_URL}/heatmap/floorplan/99999`);
    expect(res.status).toBe(404);
  });

  it("returns a list when floor plan exists", async () => {
    const res = await fetch(`${BASE_URL}/heatmap/floorplan/1`);
    if (res.status === 200) {
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    } else {
      expect(res.status).toBe(404);
    }
  });
});
