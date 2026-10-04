#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

const char* ssid = "test";
const char* password = "11111110";

const char* serverUrl = "https://smart-lamp-dashboardv2.onrender.com/api/sensors/data";
const char* modeUrl = "https://smart-lamp-dashboardv2.onrender.com/api/mode";

#define DHTPIN 14
#define DHTTYPE DHT21

#define PIRPIN 32
#define LDRPIN 33
#define LEDPIN 27

unsigned long lastModeSync = 0;
const unsigned long MODE_SYNC_INTERVAL = 2000;
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

bool confirmedPresence = false;

unsigned long lastMotionTime = 0;
const unsigned long HOLD_TIME = 5000;

int modeNameToIndex(String name) {
  if (name == "FORCE ON") return 1;
  if (name == "FORCE OFF") return 2;
  return 0;
}

void setLampOutput(bool enabled) {
  const int duty = enabled ? map(brightnessPercent, 0, 100, 0, 255) : 0;
  analogWrite(LEDPIN, duty);
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

void setup() {

  Serial.begin(115200);

  dht.begin();

  pinMode(PIRPIN, INPUT);
  pinMode(LEDPIN, OUTPUT);
  analogWrite(LEDPIN, 0);

  Serial.println("Connecting WiFi...");

  WiFi.begin(ssid, password);
  lastWifiReconnect = millis();

  Serial.println("System Started");
}

void loop() {

  const unsigned long now = millis();

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

  if (millis() - lastModeSync >= MODE_SYNC_INTERVAL) {
    fetchModeFromServer();
    lastModeSync = millis();
  }

  if (digitalRead(PIRPIN) == HIGH) {
    confirmedPresence = true;
    lastMotionTime = now;
  }
  else if (now - lastMotionTime > HOLD_TIME) {
    confirmedPresence = false;
  }

  int lightRaw = analogRead(LDRPIN);
  int lightLevel = constrain(map(lightRaw, 800, 3800, 100, 0), 0, 100);

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

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (!isnan(temperature)) lastTemp = temperature;
  if (!isnan(humidity)) lastHum = humidity;

  Serial.println("--------------------------------");

  Serial.print("Mode        : ");
  Serial.println(modeNames[currentMode]);

  Serial.print("Temperature : ");
  Serial.println(lastTemp);

  Serial.print("Humidity    : ");
  Serial.println(lastHum);

  Serial.print("People      : ");
  Serial.println(confirmedPresence ? "YES" : "NO");

  Serial.print("Light Raw   : ");
  Serial.println(lightRaw);

  Serial.print("Light Level : ");
  Serial.println(lightLevel);

  Serial.print("Lamp Status : ");
  Serial.println(lampStatus ? "ON" : "OFF");

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