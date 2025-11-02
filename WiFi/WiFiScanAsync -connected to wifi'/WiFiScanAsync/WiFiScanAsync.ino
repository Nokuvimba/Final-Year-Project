#include "WiFi.h"

// >>>>> CHANGE THESE <<<<<
const char* WIFI_SSID     = "Three_7F2C30";
const char* WIFI_PASSWORD = "5sQuXs2zv22y2z5";


void startWiFiScan() {
  Serial.println("Scan start");
  // Async scan: returns immediately, continues in background
  WiFi.scanDelete();
  WiFi.scanNetworks(true);
}

// --- add at top ---
static void jsonEscape(const String& in) {
  for (size_t i = 0; i < in.length(); ++i) {
    char c = in[i];
    if (c == '\"' || c == '\\') Serial.print('\\');
    Serial.print(c);
  }
}

static const char* encStr(wifi_auth_mode_t m) {
  switch (m) {
    case WIFI_AUTH_OPEN: return "open";
    case WIFI_AUTH_WEP: return "WEP";
    case WIFI_AUTH_WPA_PSK: return "WPA";
    case WIFI_AUTH_WPA2_PSK: return "WPA2";
    case WIFI_AUTH_WPA_WPA2_PSK: return "WPA+WPA2";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-EAP";
    case WIFI_AUTH_WPA3_PSK: return "WPA3";
    case WIFI_AUTH_WPA2_WPA3_PSK: return "WPA2+WPA3";
    case WIFI_AUTH_WAPI_PSK: return "WAPI";
    default: return "unknown";
  }
}
void printScannedNetworks(uint16_t networksFound) {
  const char* NODE_TAG = "ESP32-LAB-01"; // change per device
  if (networksFound == 0) {
    Serial.println("{\"event\":\"scan\",\"node\":\"ESP32-HOME\",\"count\":0}");
  } else {
    unsigned long ts = millis();
    for (int i = 0; i < networksFound; ++i) {
      Serial.print('{');
      Serial.print("\"node\":\""); Serial.print(NODE_TAG); Serial.print('"');
      Serial.print(",\"ts\":"); Serial.print(ts);
      Serial.print(",\"ssid\":\""); jsonEscape(WiFi.SSID(i)); Serial.print('"');
      Serial.print(",\"bssid\":\""); Serial.print(WiFi.BSSIDstr(i)); Serial.print('"');
      Serial.print(",\"rssi\":"); Serial.print(WiFi.RSSI(i));
      Serial.print(",\"channel\":"); Serial.print(WiFi.channel(i));
      Serial.print(",\"enc\":\""); Serial.print(encStr(WiFi.encryptionType(i))); Serial.print('"');
      Serial.println('}');
      delay(5);
    }
  }
  WiFi.scanDelete();
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);    // optional: avoid power-save stalls during scans
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
    delay(300);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connect timeout; will retry in loop.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  connectWiFi();     // connect first
  startWiFiScan();   // then begin async scanning
}

void loop() {
  // keep Wi-Fi alive
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > 5000) { // every 5s
    lastCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi dropped. Reconnecting...");
      connectWiFi();
    }
  }

  // check Async scan state
  int16_t st = WiFi.scanComplete();
  if (st == WIFI_SCAN_RUNNING) {
    // still scanning; do other work here if needed
  } else if (st >= 0) {
    // got results (zero or more)
    printScannedNetworks(st);
    startWiFiScan();  // start next background scan
  } else if (st == WIFI_SCAN_FAILED) {
    Serial.println("WiFi Scan failed. Restarting scan.");
    startWiFiScan();
  }

  delay(250);
  // Serial.println("Loop running..."); // uncomment if you want heartbeat logs
}