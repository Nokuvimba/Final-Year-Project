#include <DHTesp.h>

DHTesp dht;

void setup() {
  Serial.begin(115200);

  dht.setup(4, DHTesp::DHT22);  // GPIO 4
}

void loop() {
  TempAndHumidity data = dht.getTempAndHumidity(); //struct defined inside the DHTesplibrary

  if (isnan(data.temperature) || isnan(data.humidity)) {. //if the value is not a number
    Serial.println("Failed to read from DHT22");
    delay(2000);
    return;
  }

  Serial.print("Temperature: ");
  Serial.print(data.temperature);
  Serial.print(" °C | Humidity: ");
  Serial.print(data.humidity);
  Serial.println(" %");

  delay(2000);
}