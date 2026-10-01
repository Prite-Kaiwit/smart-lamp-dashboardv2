#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <string.h>

// =========================
// WiFi
// =========================
const char* ssid = "test";
const char* password = "11111110";

// Render server (HTTPS)
const char* serverUrl = "https://smart-lamp-dashboardv2.onrender.com/api/sensors/data";
const char* modeUrl = "https://smart-lamp-dashboardv2.onrender.com/api/mode";

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

// =========================
// Mode Button
// =========================
#define BUTTONPIN 27          // ขาปุ่มกด (ต่อ GND อีกด้าน, ใช้ INPUT_PULLUP)
unsigned long lastButtonPress = 0;
const unsigned long DEBOUNCE_DELAY = 300;   // ms กันการกดซ้ำ/สั่น
bool lastButtonState = HIGH;                // ค่าเริ่มต้นตอนไม่กด (pull-up)
unsigned long lastModeSync = 0;
const unsigned long MODE_SYNC_INTERVAL = 2000;
unsigned long lastLocalModeChange = 0;
const unsigned long MODE_SYNC_HOLDOFF = 3000;
unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL = 2000;
unsigned long lastWifiReconnect = 0;
const unsigned long WIFI_RECONNECT_INTERVAL = 10000;

// โหมดการทำงาน: 0 = AUTO, 1 = FORCE ON, 2 = FORCE OFF
int currentMode = 0;
String modeNames[3] = {"AUTO", "FORCE ON", "FORCE OFF"};
int brightnessPercent = 100;
bool autoLampOn = false;
unsigned long lastAutoSwitch = 0;
const unsigned long MIN_SWITCH_MS = 3000;
const int DARK_ON_LEVEL = 30;
const int DARK_OFF_LEVEL = 45;

DHT dht(DHTPIN, DHTTYPE);
float lastTemp = 0;
float lastHum = 0;

String inputString = "";

bool rawPresence = false;
bool confirmedPresence = false;

unsigned long lastONTime = 0;
const unsigned long HOLD_TIME = 5000;

int lastDistance = -1;

// Learn repeated range noise while the room is empty.
const int BIN_CM = 10;
const int NUM_BINS = 81;
int noiseHits[NUM_BINS] = {};
bool noiseMask[NUM_BINS] = {};
bool calibrating = false;
unsigned long calibStart = 0;
const unsigned long CALIB_MS = 60000;

int modeNameToIndex(String name) {
  if (name == "FORCE ON") return 1;
  if (name == "FORCE OFF") return 2;
  return 0;
}

void setLampOutput(bool enabled) {
  const int duty = enabled ? map(brightnessPercent, 0, 100, 0, 255) : 0;
  analogWrite(LEDPIN, duty);
}

void startCalibration() {
  memset(noiseHits, 0, sizeof(noiseHits));
  calibrating = true;
  calibStart = millis();
  rawPresence = false;
  confirmedPresence = false;
  lastDistance = -1;
  Serial.println("CALIBRATING: Leave the room empty for 60 seconds");
}

void finishCalibration() {
  memset(noiseMask, 0, sizeof(noiseMask));
  for (int i = 0; i < NUM_BINS; i++) {
    if (noiseHits[i] >= 2) {
      for (int j = i - 1; j <= i + 1; j++) {
        if (j >= 0 && j < NUM_BINS) noiseMask[j] = true;
      }
    }
  }
  calibrating = false;
  Serial.println("CALIBRATION DONE");
}

bool isNoise(int cm) {
  const int bin = cm / BIN_CM;
  return bin >= 0 && bin < NUM_BINS && noiseMask[bin];
}

void fetchModeFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, modeUrl);
  http.setConnectTimeout(3000);
  http.setTimeout(3000);

  const int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    const String payload = http.getString();
    const int marker = payload.indexOf("\"mode\":\"");
    if (marker >= 0) {
      const int start = marker + 8;
      const int end = payload.indexOf('\"', start);
      if (end > start) currentMode = modeNameToIndex(payload.substring(start, end));
    }

    const int brightnessMarker = payload.indexOf("\"brightness\":");
    if (brightnessMarker >= 0) {
      const int brightnessStart = brightnessMarker + 13;
      const int serverBrightness = payload.substring(brightnessStart).toInt();
      if (serverBrightness >= 10 && serverBrightness <= 100) {
        brightnessPercent = serverBrightness;
      }
    }
  }
  http.end();
}

void pushModeToServer(String mode) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, modeUrl);
  http.setConnectTimeout(3000);
  http.setTimeout(3000);
  http.addHeader("Content-Type", "application/json");

  const String json = "{\"mode\":\"" + mode + "\"}";
  const int httpCode = http.POST(json);
  Serial.print("Push Mode HTTP Code: ");
  Serial.println(httpCode);
  http.end();
}

void setup() {

  Serial.begin(115200);

  dht.begin();

  pinMode(LEDPIN, OUTPUT);
  analogWrite(LEDPIN, 0);

  pinMode(BUTTONPIN, INPUT_PULLUP);   // ปุ่มกด ต่อขาหนึ่งลง GND

  Serial2.setRxBufferSize(1024);
  Serial2.begin(115200, SERIAL_8N1, RXD2, TXD2);

  Serial.println("Connecting WiFi...");

  WiFi.begin(ssid, password);
  lastWifiReconnect = millis();

  Serial.println("System Started");
}

void loop() {

  const unsigned long now = millis();

  while (Serial.available()) {
    if (Serial.read() == 'C') startCalibration();
  }

  if (calibrating && now - calibStart >= CALIB_MS) finishCalibration();

  if (WiFi.status() == WL_CONNECTED) {
    if (lastModeSync == 0) {
      fetchModeFromServer();
      lastModeSync = millis();
    }
    if (now - lastWifiReconnect >= WIFI_RECONNECT_INTERVAL) {
      lastWifiReconnect = now;
    }
  }
  else if (now - lastWifiReconnect >= WIFI_RECONNECT_INTERVAL) {
    WiFi.reconnect();
    lastWifiReconnect = now;
  }

  // =====================
  // อ่านปุ่มกด (สลับโหมด)
  // =====================
  bool buttonState = digitalRead(BUTTONPIN);

  // ตรวจจับขอบขาลง (กดปุ่ม) + debounce
  if (buttonState == LOW && lastButtonState == HIGH &&
      (millis() - lastButtonPress > DEBOUNCE_DELAY)) {

    currentMode = (currentMode + 1) % 3;   // วน 0 -> 1 -> 2 -> 0
    lastButtonPress = millis();

    Serial.print(">>> Mode Changed To: ");
    Serial.println(modeNames[currentMode]);
    pushModeToServer(modeNames[currentMode]);
    lastLocalModeChange = millis();
  }

  lastButtonState = buttonState;

  if (millis() - lastLocalModeChange >= MODE_SYNC_HOLDOFF &&
      millis() - lastModeSync >= MODE_SYNC_INTERVAL) {
    fetchModeFromServer();
    lastModeSync = millis();
  }

  // =====================
  // อ่านข้อมูล LD2420
  // =====================
  while (Serial2.available()) {

    char c = Serial2.read();

    if (c == '\n' || c == '\r') {

      inputString.trim();
      inputString.toUpperCase();

      if (inputString.indexOf("OFF") >= 0) {
        rawPresence = false;
      }
      else if (inputString.indexOf("RANGE") >= 0) {
        int idx = inputString.indexOf(' ');
        if (idx > 0) {
          const int distance = inputString.substring(idx + 1).toInt();
          if (distance > 0 && distance <= 800) {
            const int bin = distance / BIN_CM;
            if (calibrating) {
              if (bin >= 0 && bin < NUM_BINS) noiseHits[bin]++;
            }
            else if (!isNoise(distance)) {
              rawPresence = true;
              lastONTime = millis();
              lastDistance = distance;
            }
          }
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
  // LDR
  // =====================
  int lightRaw = analogRead(LDRPIN);
  int lightLevel = constrain(map(lightRaw, 800, 3800, 100, 0), 0, 100);

  // =====================
  // Lamp Logic (รองรับ 3 โหมด)
  // =====================
  bool lampStatus = false;

  if (currentMode == 1) {              // FORCE ON
    setLampOutput(true);
    lampStatus = true;
  }
  else if (currentMode == 2) {         // FORCE OFF
    setLampOutput(false);
    lampStatus = false;
  }
  else {                               // AUTO
    bool want = autoLampOn;
    if (!autoLampOn && lightLevel < DARK_ON_LEVEL && confirmedPresence) want = true;
    if (autoLampOn && (!confirmedPresence || lightLevel > DARK_OFF_LEVEL)) want = false;

    if (want != autoLampOn && millis() - lastAutoSwitch > MIN_SWITCH_MS) {
      autoLampOn = want;
      lastAutoSwitch = millis();
    }
    setLampOutput(autoLampOn);
    lampStatus = autoLampOn;
  }

  if (millis() - lastTelemetry < TELEMETRY_INTERVAL) return;
  lastTelemetry = millis();

  // DHT21 reads can fail temporarily; keep the latest valid values.
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (!isnan(temperature)) lastTemp = temperature;
  if (!isnan(humidity)) lastHum = humidity;

  // =====================
  // Serial Monitor
  // =====================
  Serial.println("--------------------------------");

  Serial.print("Mode        : ");
  Serial.println(modeNames[currentMode]);

  Serial.print("Temperature : ");
  Serial.println(lastTemp);

  Serial.print("Humidity    : ");
  Serial.println(lastHum);

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
  // Send to Web API (HTTPS -> Render)
  // =====================
  if (WiFi.status() == WL_CONNECTED) {

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;

    http.begin(client, serverUrl);
    http.setConnectTimeout(3000);
    http.setTimeout(3000);

    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"temperature\":" + String(lastTemp, 1) + ",";
    json += "\"humidity\":" + String(lastHum, 1) + ",";
    json += "\"peopleDetected\":" + String(confirmedPresence ? "true" : "false") + ",";
    json += "\"distance\":" + String(lastDistance) + ",";
    json += "\"lightRaw\":" + String(lightRaw) + ",";
    json += "\"lightLevel\":" + String(lightLevel) + ",";
    json += "\"lampStatus\":\"" + String(lampStatus ? "ON" : "OFF") + "\"";
    json += "}";

    Serial.println("Sending JSON:");
    Serial.println(json);

    int httpCode = http.POST(json);

    Serial.print("HTTP Response : ");
    Serial.println(httpCode);

    if (httpCode > 0) {
      String response = http.getString();

      Serial.println("Server Response:");
      Serial.println(response);
    }

    http.end();
  }
}