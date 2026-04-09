// MQ135_Test.ino
// Tests the MQ-135 air quality sensor on GPIO 34.
// No library needed — just analogRead().

const int MQ135_PIN = 34;  // GPIO 34 — ADC input only pin

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("MQ-135 Test Starting...");
  Serial.println("Note: Sensor needs ~30 seconds to warm up.");
  Serial.println("--------------------------------------");
}

void loop() {
  // Read raw 12-bit ADC value (0 = 0V, 4095 = 3.3V)
  int rawValue = analogRead(MQ135_PIN);

  // Simple PPM estimate — rough linear approximation for CO2
  // In clean air (~400 PPM CO2): raw typically 200–600
  // In poor air (>1000 PPM):     raw typically 1500–3000
  float voltage = rawValue * (3.3 / 4095.0);
  float ppm = map(rawValue, 0, 4095, 0, 5000);

  Serial.print("Raw ADC: ");
  Serial.print(rawValue);
  Serial.print("  |  Voltage: ");
  Serial.print(voltage, 2);
  Serial.print("V  |  Est. PPM: ");
  Serial.println(ppm);

  delay(2000);  // DHT22 also reads every 2s — keep them in sync
}
