/*
  VaniGrow v2 - VPD-based Fungal Risk Monitoring
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MLX90614.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <math.h>

// ---------------- Pin Configuration ----------------
#define DHTPIN        4
#define DHTTYPE       DHT22
#define SOIL_PIN      34
#define LIGHT_PIN     35
#define LED_ALERT_PIN 25
#define LED_FAN_PIN   26
#define SERVO_PIN     27
#define BUTTON_PIN    32

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1

// ---------------- WiFi & MQTT ----------------
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

const char* MQTT_SERVER = "broker.emqx.io";
const int   MQTT_PORT   = 1883;
const char* DEVICE_ID   = "gh01";

String TOPIC_DATA   = "vanigrow/" + String(DEVICE_ID) + "/data";
String TOPIC_STATUS = "vanigrow/" + String(DEVICE_ID) + "/status";
String TOPIC_CMD    = "vanigrow/" + String(DEVICE_ID) + "/cmd";

// ---------------- VPD / Risk Model ----------------
#define DEMO_MODE true

const float VPD_LOW_THRESHOLD      = 0.4;
const float VPD_CRITICAL_THRESHOLD = 0.2;

#if DEMO_MODE
  const unsigned long TIME_UNIT_MS = 1000UL;
#else
  const unsigned long TIME_UNIT_MS = 60000UL;
#endif

const unsigned long DURATION_MEDIUM_MS = 5UL  * TIME_UNIT_MS;
const unsigned long DURATION_HIGH_MS   = 15UL * TIME_UNIT_MS;
const float DECAY_MULTIPLIER = 1.5;

// ---------------- Globals ----------------
DHT dht(DHTPIN, DHTTYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
Adafruit_MLX90614 mlx = Adafruit_MLX90614();
WiFiClient espClient;
PubSubClient mqttClient(espClient);
Servo ventServo;

float g_airTemp = 25.0, g_airHum = 60.0;
float g_leafTemp = 25.0;
float g_vpd = 0;
int   g_soilPct = 0, g_lightPct = 0;
String g_lastCmd = "None";

double g_vpdAccumulatorMs = 0;
String g_riskLevel = "LOW";

bool  g_fanOn = false;
int   g_ventAngle = 0;
bool  g_autoMode = true;

int   g_menuPage = 0;
bool  g_lastButtonState = HIGH;
bool  g_buttonConfirmed = HIGH;
unsigned long g_lastDebounce = 0;
unsigned long g_buttonPressTime = 0;
unsigned long g_lastSensorRead = 0;
unsigned long g_lastPublish = 0;

const unsigned long SENSOR_INTERVAL  = 1000;
const unsigned long PUBLISH_INTERVAL = 1000;

// ---------------- Function Prototypes ----------------
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void readSensors();
float calcSVP(float tempC);
float calcVPD(float leafTempC, float airTempC, float airRH);
void updateVpdAccumulator(unsigned long elapsedMs);
void computeFungalRisk();
void applyActuators();
void publishData();
void handleButton();
void renderOLED();
void renderOverview();
void renderFungalRisk();
void renderNetwork();

// ---------------- Setup ----------------
void setup() {
  Serial.begin(115200);

  pinMode(LED_ALERT_PIN, OUTPUT);
  pinMode(LED_FAN_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  dht.begin();
  ventServo.attach(SERVO_PIN);
  ventServo.write(0);

  Wire.begin();
  mlx.begin();

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("SSD1306 allocation failed");
  }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println("VaniGrow booting...");
  display.display();

  connectWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

// ---------------- Loop ----------------
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  unsigned long now = millis();

  if (now - g_lastSensorRead >= SENSOR_INTERVAL) {
    unsigned long elapsed = now - g_lastSensorRead;
    g_lastSensorRead = now;
    readSensors();
    updateVpdAccumulator(elapsed);
    computeFungalRisk();
    applyActuators();
  }

  if (now - g_lastPublish >= PUBLISH_INTERVAL) {
    g_lastPublish = now;
    publishData();
  }

  handleButton();
  renderOLED();
}

// ---------------- WiFi ----------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed, will retry.");
  }
}

// ---------------- MQTT ----------------
void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    String clientId = "vanigrow-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    bool ok = mqttClient.connect(
      clientId.c_str(),
      NULL, NULL,
      TOPIC_STATUS.c_str(), 0, true, "offline"
    );
    if (ok) {
      Serial.println("connected");
      mqttClient.publish(TOPIC_STATUS.c_str(), "online", true);
      mqttClient.subscribe(TOPIC_CMD.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 3s");
      delay(3000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("CMD received: " + msg);
  g_lastCmd = msg;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, msg);
  if (err) {
    Serial.println("Failed to parse cmd JSON");
    return;
  }

  if (doc.containsKey("auto")) {
    g_autoMode = doc["auto"].as<bool>();
  }
  if (!g_autoMode) {
    if (doc.containsKey("fan")) {
      g_fanOn = doc["fan"].as<bool>();
      digitalWrite(LED_FAN_PIN, g_fanOn ? HIGH : LOW);
    }
    if (doc.containsKey("vent")) {
      g_ventAngle = constrain(doc["vent"].as<int>(), 0, 90);
      ventServo.write(g_ventAngle);
    }
  }

  publishData();
  g_lastPublish = millis();
}

// ---------------- Sensors ----------------
void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  
  float tempNoise = random(-5, 6) / 10.0;
  float humNoise  = random(-15, 16) / 10.0;
  
  if (!isnan(t)) g_airTemp = t + tempNoise;
  if (!isnan(h)) g_airHum = h + humNoise;

  float leaf = mlx.readObjectTempC();
  float leafNoise = random(-3, 4) / 10.0;
  
  if (!isnan(leaf) && leaf > 5.0) {
    g_leafTemp = leaf + leafNoise;
  } else {
    g_leafTemp = g_airTemp - 0.2;
  }

  int soilRaw = analogRead(SOIL_PIN);
  g_soilPct = map(soilRaw, 0, 4095, 200, 0) + random(-2, 3);
  if(g_soilPct < 0) g_soilPct = 0;
  if(g_soilPct > 200) g_soilPct = 200;

  int lightRaw = analogRead(LIGHT_PIN);
  // Rumus konversi ADC ke Lux untuk Sensor Wokwi LDR di ESP32 (3.3V)
  float voltage = lightRaw / 4095.0 * 3.3;
  if (voltage > 3.29) voltage = 3.29; // Mencegah division by zero
  float resistance = 2000.0 * voltage / (3.3 - voltage); 
  float lux = pow((50.0 * 1e3 * pow(10, 0.7)) / resistance, (1 / 0.7));
  g_lightPct = (int)lux;

  g_vpd = calcVPD(g_leafTemp, g_airTemp, g_airHum);
}

// ---------------- VPD Model ----------------
float calcSVP(float tempC) {
  return 0.6108 * exp((17.27 * tempC) / (tempC + 237.3));
}

float calcVPD(float leafTempC, float airTempC, float airRH) {
  float svpLeaf = calcSVP(leafTempC);
  float svpAir  = calcSVP(airTempC);
  float avpAir  = svpAir * (airRH / 100.0);
  return svpLeaf - avpAir;
}

void updateVpdAccumulator(unsigned long elapsedMs) {
  if (g_vpd < VPD_CRITICAL_THRESHOLD) {
    g_vpdAccumulatorMs += elapsedMs * 2.0;
  } else if (g_vpd < VPD_LOW_THRESHOLD) {
    g_vpdAccumulatorMs += elapsedMs;
  } else {
    g_vpdAccumulatorMs -= elapsedMs * DECAY_MULTIPLIER;
    if (g_vpdAccumulatorMs < 0) g_vpdAccumulatorMs = 0;
  }

  double cap = (double)DURATION_HIGH_MS * 2.0;
  if (g_vpdAccumulatorMs > cap) g_vpdAccumulatorMs = cap;
}

// ---------------- Fungal Risk Level ----------------
void computeFungalRisk() {
  String level;
  if (g_vpdAccumulatorMs >= DURATION_HIGH_MS) level = "HIGH";
  else if (g_vpdAccumulatorMs >= DURATION_MEDIUM_MS) level = "MEDIUM";
  else level = "LOW";

  if (g_soilPct < 10) {
    if (level == "LOW") level = "MEDIUM";
    else if (level == "MEDIUM") level = "HIGH";
  }

  g_riskLevel = level;
}

// ---------------- Actuators ----------------
void applyActuators() {
  if (!g_autoMode) return;

  if (g_riskLevel == "HIGH") {
    digitalWrite(LED_ALERT_PIN, HIGH);
    digitalWrite(LED_FAN_PIN, HIGH);
    g_fanOn = true;
    g_ventAngle = 90;
  } else if (g_riskLevel == "MEDIUM") {
    digitalWrite(LED_ALERT_PIN, LOW);
    digitalWrite(LED_FAN_PIN, HIGH);
    g_fanOn = true;
    g_ventAngle = 45;
  } else {
    digitalWrite(LED_ALERT_PIN, LOW);
    digitalWrite(LED_FAN_PIN, LOW);
    g_fanOn = false;
    g_ventAngle = 0;
  }
  ventServo.write(g_ventAngle);
}

// ---------------- MQTT Publish ----------------
void publishData() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<320> doc;
  doc["device"] = DEVICE_ID;
  doc["air_temp"] = g_airTemp;
  doc["air_hum"] = g_airHum;
  doc["leaf_temp"] = g_leafTemp;
  doc["vpd"] = g_vpd;
  doc["low_vpd_duration_min"] = g_vpdAccumulatorMs / (double)TIME_UNIT_MS;
  doc["soil"] = g_soilPct;
  doc["light"] = g_lightPct;
  doc["risk_level"] = g_riskLevel;
  doc["fan"] = g_fanOn;
  doc["vent"] = g_ventAngle;
  doc["auto"] = g_autoMode;
  doc["ts"] = millis();

  char buffer[320];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_DATA.c_str(), buffer);
}

// ---------------- Button / Menu ----------------
void handleButton() {
  bool reading = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  if (reading != g_lastButtonState) {
    g_lastDebounce = now;
  }
  g_lastButtonState = reading;

  if ((now - g_lastDebounce) > 50) {
    if (reading == LOW && g_buttonConfirmed != LOW) {
      g_buttonPressTime = now;
    }
    if (reading == HIGH && g_buttonConfirmed == LOW) {
      unsigned long dur = now - g_buttonPressTime;
      if (dur < 600) {
        g_menuPage = (g_menuPage + 1) % 3;
      } else if (dur < 2000) {
        g_vpdAccumulatorMs = 0;
        g_riskLevel = "LOW";
        Serial.println("[DEMO] Accumulator reset to 0");
      } else {
        g_menuPage = (g_menuPage + 2) % 3;
      }
    }
    g_buttonConfirmed = reading;
  }
}

// ---------------- OLED Rendering ----------------
void renderOLED() {
  display.clearDisplay();
  switch (g_menuPage) {
    case 0: renderOverview(); break;
    case 1: renderFungalRisk(); break;
    case 2: renderNetwork(); break;
  }
  display.display();
}

void renderOverview() {
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("VaniGrow - Overview");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 16);
  display.printf("Suhu udara : %.1f C\n", g_airTemp);
  display.setCursor(0, 27);
  display.printf("Lembap udr : %.1f %%\n", g_airHum);
  display.setCursor(0, 38);
  display.printf("Suhu daun  : %.1f C\n", g_leafTemp);
  display.setCursor(0, 49);
  display.printf("Soil:%dcb LDR:%dlx\n", g_soilPct, g_lightPct);
}

void renderFungalRisk() {
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("VPD & Fungal Risk");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 16);
  display.printf("VPD: %.2f kPa\n", g_vpd);

  double lowMin = g_vpdAccumulatorMs / (double)TIME_UNIT_MS;
  display.setCursor(0, 27);
  display.printf("Low-VPD dur: %.1f mnt\n", lowMin);

  display.setTextSize(2);
  display.setCursor(0, 40);
  display.println(g_riskLevel);

  display.setTextSize(1);
  display.setCursor(0, 56);
  display.printf("Fan:%s Vent:%d\n", g_fanOn ? "ON" : "OFF", g_ventAngle);
}

void renderNetwork() {
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Network / MQTT");
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 18);
  display.print("WiFi: ");
  display.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");

  display.setCursor(0, 30);
  display.print("MQTT: ");
  display.println(mqttClient.connected() ? "Connected" : "Disconnected");

  display.setCursor(0, 42);
  display.print("Cmd: ");
  display.println(g_lastCmd.substring(0, 15));

  display.setCursor(0, 54);
  display.println("IP:" + WiFi.localIP().toString());
}
