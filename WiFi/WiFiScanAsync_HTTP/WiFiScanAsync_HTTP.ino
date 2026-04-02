// WiFiScanAsync_HTTP.ino
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===========================================================
// CONFIGURATION SECTION
// ===========================================================

// Your Wi-Fi credentials
const char* WIFI_SSID     =  "Three_7F2C30"; //"ATU-Galway-Guest-Aruba";//"Talie";  //"Three_7F2C30";
const char* WIFI_PASSWORD =   "5sQuXs2zv22y2z5";// "225299";//"N7talie123"; //"5sQuXs2zv22y2z5";

// My FastAPI endpoint using the laptop's LAN IP
const char* INGEST_URL    = "http://192.168.0.6:8000/ingest"; //Home
//const char* INGEST_URL = "http://172.20.10.5:8000/ingest"; //ATU

// Tag to identify which ESP32 sent the scan.
// Must match an assigned_node in the Admin Map Studio — unknown nodes are rejected.
const char* NODE_TAG      = "ESP32-LAB-01";

// FUNCTION DECLARATIONS
// ===========================================================
void connectWiFi();
void startWiFiScan();
void postScannedNetworks(int16_t networksFound);
int  httpPostPayload(const String& payload);

// CONNECT TO WIFI 
// ===========================================================

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;  // already connected

  Serial.printf("Connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(true, true); // clear any old connection state
  delay(200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttemptTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("✅ WiFi connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("⚠️ WiFi connect timeout — will retry in loop.");
  }
}

// ===========================================================
// START A BACKGROUND WIFI SCAN
// ===========================================================
void startWiFiScan() {
  if (WiFi.status() != WL_CONNECTED) return; // only scan if connected
  Serial.println("🔍 Starting async Wi-Fi scan...");
  WiFi.scanDelete();               // clear old results
  WiFi.scanNetworks(true, true);   // async mode, include hidden networks
}

// ===========================================================
// HTTP POST HELPER — send JSON payload to FastAPI
// ===========================================================
int httpPostPayload(const String& payload) {
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(payload);
  http.end();

  Serial.printf("📡 POST /ingest -> %d\n", code);
  return code;
}

// ===========================================================
// BUILD JSON PAYLOAD FROM SCAN RESULTS + SEND TO SERVER
//
// Payload format (matches FastAPI /ingest endpoint):
// {
//   "node": "ESP32-LAB-01",
//   "scans": [
//     { "ssid": "ATU-WiFi", "bssid": "aa:bb:cc:dd:ee:ff",
//       "rssi": -65, "channel": 6, "enc": 4 }
//   ]
// }
//
// NOTE: No timestamp sent from the ESP32.
// The server stamps received_at = datetime.now(UTC) when the POST arrives.
// millis() is unreliable (resets on reboot, not a real clock).
// ===========================================================
void postScannedNetworks(int16_t networksFound) {
  if (networksFound <= 0) return;

  StaticJsonDocument<4096> doc;

  // Top-level fields
  doc["node"] = NODE_TAG;

  // Scans array — one object per SSID found
  JsonArray scans = doc.createNestedArray("scans");

  for (int i = 0; i < networksFound; ++i) {
    JsonObject o = scans.createNestedObject();
    o["ssid"]    = WiFi.SSID(i);
    o["bssid"]   = WiFi.BSSIDstr(i);
    o["rssi"]    = WiFi.RSSI(i);
    o["channel"] = WiFi.channel(i);
    o["enc"]     = WiFi.encryptionType(i);
    // NOTE: "ts" (millis) intentionally removed — server adds real UTC timestamp
  }

  String payload;
  serializeJson(doc, payload);
  httpPostPayload(payload);

  WiFi.scanDelete();  // clear results
}

// ===========================================================
// SETUP
// ===========================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  connectWiFi();      // connect to Wi-Fi first
  startWiFiScan();    // start initial scan
}

// ===========================================================
// MAIN LOOP
// ===========================================================
void loop() {
  static unsigned long lastCheck = 0;

  // Every 5 seconds, check Wi-Fi connection
  if (millis() - lastCheck > 5000) {
    lastCheck = millis();

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("⚠️ WiFi dropped. Reconnecting...");
      connectWiFi();

      // Only start a new scan if reconnection worked
      if (WiFi.status() == WL_CONNECTED) {
        startWiFiScan();
      }
      return;
    }
  }

  // Handle async scan completion
  int16_t st = WiFi.scanComplete();
  if (st == WIFI_SCAN_RUNNING) {
    // still scanning, do nothing
    return;
  } else if (st >= 0) {
    // scan done, send results
    Serial.printf("📶 Found %d networks.\n", st);
    postScannedNetworks(st);
    startWiFiScan();  // start next scan
  } else if (st == WIFI_SCAN_FAILED) {
    Serial.println("❌ Scan failed. Restarting...");
    startWiFiScan();
  }

  delay(250); // small heartbeat delay
}
