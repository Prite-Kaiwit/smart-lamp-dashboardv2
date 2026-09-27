#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// =========================
// WiFi
// =========================
const char* ssid = "test";
const char* password = "11111110";

// เปลี่ยนเป็น IP คอมของคุณ
const char* serverUrl = "http://192.168.1.42:5000/api/sensors/data";

// =========================
// DHT21
// =========================
#define DHTPIN 14
#define DHTTYPE DHT21

// =========================
// HLK-LD2420
// =========================
#define RXD2 18
#define TXD2 19

// =========================
// LDR + LED
// =========================
#define LDRPIN 33
#define LEDPIN 32

DHT dht(DHTPIN, DHTTYPE);

String inputString = "";

bool rawPresence = false;
bool confirmedPresence = false;

unsigned long lastONTime = 0;
const unsigned long HOLD_TIME = 5000;

int lastDistance = -1;

void setup() {

  Serial.begin(115200);

  dht.begin();

  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);

  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);

  Serial.println("Connecting WiFi...");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi Connected : ");
  Serial.println(WiFi.localIP());

  Serial.println("System Started");
}

void loop() {

  // =====================ผ
  // อ่านข้อมูล LD2420
  // =====================
  while (Serial2.available()) {

    char c = Serial2.read();

    if (c == '\n' || c == '\r') {

      inputString.trim();
      inputString.toUpperCase();

      if (inputString.indexOf("ON") >= 0) {
        rawPresence = true;
        lastONTime = millis();
      }

      if (inputString.indexOf("OFF") >= 0) {
        rawPresence = false;
      }

      if (inputString.indexOf("RANGE") >= 0) {

        int idx = inputString.indexOf(' ');

        if (idx > 0) {
          lastDistance = inputString.substring(idx + 1).toInt();
        }
      }

      inputString = "";
    }
    else {
      inputString += c;
    }
  }

  // =====================
  // Presence Hold 5 sec
  // =====================
  if (rawPresence) {
    confirmedPresence = true;
  }
  else if (millis() - lastONTime > HOLD_TIME) {
    confirmedPresence = false;
    lastDistance = -1;
  }

  // =====================
  // DHT21
  // =====================
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // =====================
  // LDR
  // =====================
  int lightRaw = analogRead(LDRPIN);

  bool isDark = (lightRaw > 1800);

  int lightLevel = map(lightRaw, 800, 3800, 100, 0);
  lightLevel = constrain(lightLevel, 0, 100);

  // =====================
  // Auto Light
  // =====================
  bool lampStatus = false;

  if (isDark && confirmedPresence) {
    digitalWrite(LEDPIN, HIGH);
    lampStatus = true;
  }
  else {
    digitalWrite(LEDPIN, LOW);
    lampStatus = false;
  }

  // =====================
  // Serial Monitor
  // =====================
  Serial.println("--------------------------------");

  Serial.print("Temperature : ");
  Serial.println(temperature);

  Serial.print("Humidity    : ");
  Serial.println(humidity);

  Serial.print("People      : ");
  Serial.println(confirmedPresence ? "YES" : "NO");

  Serial.print("Distance    : ");
  Serial.println(lastDistance);

  Serial.print("Light Raw   : ");
  Serial.println(lightRaw);

  Serial.print("Light Level : ");
  Serial.println(lightLevel);

  Serial.print("Lamp Status : ");
  Serial.println(lampStatus ? "ON" : "OFF");

  // =====================
  // Send to Web API
  // =====================
  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin(serverUrl);

    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"temperature\":" + String(temperature, 1) + ",";
    json += "\"humidity\":" + String(humidity, 1) + ",";
    json += "\"peopleDetected\":" + String(confirmedPresence ? "true" : "false") + ",";
    json += "\"distance\":" + String(lastDistance) + ",";
    json += "\"lightRaw\":" + String(lightRaw) + ",";
    json += "\"lightLevel\":" + String(lightLevel) + ",";
    json += "\"lampStatus\":\"" + String(lampStatus ? "ON" : "OFF") + "\"";
    json += "}";

    int httpCode = http.POST(json);

    Serial.print("HTTP Response : ");
    Serial.println(httpCode);

    http.end();
  }

  delay(2000);
}