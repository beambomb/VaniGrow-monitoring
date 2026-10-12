# 🌱 VaniGrow — IoT VPD-based Fungal Risk Monitoring System

Sistem pemantauan mikroklimat dan peringatan dini risiko infeksi jamur (*Fusarium stem rot*) berbasis **Vapor Pressure Deficit (VPD)** secara *real-time* untuk perkebunan vanili (*Vanilla planifolia*).

Solusi *end-to-end* ini mencakup firmware mikrokontroler ESP32 (terintegrasi simulasi Wokwi), *telemetry bridge* Node.js, database Supabase PostgreSQL, serta dashboard modern berbasis Next.js 16 dengan fitur kendali aktuator dua arah dan ekspor laporan berkala.

---

## 📑 Daftar Isi

- [Arsitektur Sistem](#-arsitektur-sistem)
- [Struktur Repositori](#-struktur-repositori)
- [Komponen & Skema Wiring](#-komponen--skema-wiring)
- [Algoritma & Model Risiko Jamur](#-algoritma--model-risiko-jamur)
- [Spesifikasi Komunikasi MQTT](#-spesifikasi-komunikasi-mqtt)
- [Skema Basis Data (Supabase)](#-skema-basis-data-supabase)
- [Panduan Instalasi & Menjalankan](#-panduan-instalasi--menjalankan)
  - [1. Firmware & Simulasi ESP32 (Wokwi)](#1-firmware--simulasi-esp32-wokwi)
  - [2. Layanan Telemetry Bridge (Node.js)](#2-layanan-telemetry-bridge-nodejs)
  - [3. Web Dashboard (Next.js 16)](#3-web-dashboard-nextjs-16)
- [Fitur Utama Dashboard](#-fitur-utama-dashboard)
- [Panduan Deployment Cloud](#-panduan-deployment-cloud)

---

## 🏛 Arsitektur Sistem

```
┌─────────────────────────────────┐
│     ESP32 Node (Wokwi / HW)     │
│  - DHT22 (Air Temp & Humidity)  │
│  - MLX90614 (Leaf Temp IR)      │
│  - Soil & Light Sensors         │
│  - OLED 128x64 & Push Button    │
│  - Actuators: Fan, Servo, Alert │
└──────────────┬──────────────────┘
               │
      MQTT (broker.emqx.io)
   Topics: data, status, cmd
               │
               ├─────────────────────────────────────────┐
               ▼                                         ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Node.js Ingestion Bridge    │          │     Next.js Web API          │
│  - Subscribes to telemetry   │          │  - Sends Remote Commands     │
│  - Data validation & math    │          │    via MQTT POST /api/cmd    │
│  - Heartbeat status tracking │          └──────────────────────────────┘
└──────────────┬───────────────┘                         ▲
               │                                         │
       REST / Service Key                                │
               ▼                                         │
┌──────────────────────────────┐                         │
│     Supabase PostgreSQL      │                         │
│  - Table: sensor_logs        │                         │
│  - Table: device_status      │                         │
│  - Realtime Publications     │                         │
└──────────────┬───────────────┘                         │
               │                                         │
        Client Polling / Supabase SDK                    │
               ▼                                         │
┌────────────────────────────────────────────────────────┴─────┐
│                 VaniGrow Web Dashboard (Next.js 16)           │
│  - Real-time Microclimate Metrics & Fungal Risk Gauge        │
│  - Interactive Time-Series Graphs (Recharts)                 │
│  - Remote Actuator Control (Auto/Manual, Fan, Vent Servo)    │
│  - Daily PDF Audit Report & Raw CSV Exporter                 │
│  - Dark / Light Theme Mode                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Struktur Repositori

```
web_iot/
├── README.md               # Dokumentasi utama proyek VaniGrow
├── diagram.json            # Skema wiring sirkuit Wokwi Simulator ESP32
├── sketch.ino              # Source code C++ Arduino/ESP32 firmware
├── package.json            # Runner script untuk deployment root (Glitch/PaaS)
│
├── bridge/                 # Microservice Node.js MQTT-to-Supabase Bridge
│   ├── .env.example        # Contoh konfigurasi variabel lingkungan bridge
│   ├── index.js            # Worker subscriber MQTT, parsing, & inserter database
│   ├── package.json        # Dependensi bridge (mqtt, @supabase/supabase-js, dotenv)
│   ├── Procfile            # Deployment target (Railway / Heroku)
│   └── README.md           # Petunjuk khusus bridge service
│
└── dashboard/              # Aplikasi Web Frontend & API (Next.js 16)
    ├── .env.local          # Konfigurasi Supabase URL & Public Anon Key
    ├── package.json        # Dependensi frontend (Next 16, React 19, Recharts, jsPDF)
    ├── README.md           # Petunjuk pengembangan web dashboard
    ├── src/
    │   ├── app/
    │   │   ├── api/cmd/    # API Route untuk mem-publish command MQTT ke device
    │   │   ├── globals.css # Styling Tailwind CSS v4 & konfigurasi dark theme
    │   │   ├── layout.tsx  # Root layout web Next.js
    │   │   └── page.tsx    # Halaman utama visualisasi monitoring & kontrol
    │   ├── components/
    │   │   ├── DeviceControl.tsx   # Panel kendali manual/otomatis aktuator
    │   │   ├── ReportModal.tsx     # Generator ekspor CSV & laporan audit PDF
    │   │   ├── RiskBadge.tsx       # Indikator status risiko jamur (LOW/MED/HIGH)
    │   │   ├── SensorCard.tsx      # Kartu metrik live sensor
    │   │   ├── TimeSeriesChart.tsx # Visualisasi grafik tren historis
    │   │   ├── ThemeProvider.tsx   # Provider tema Next-Themes
    │   │   └── ThemeToggle.tsx     # Toggle mode terang / gelap
    │   └── lib/
    │       └── supabase.ts # Inisialisasi Supabase client & TypeScript type definitions
```

---

## 🔌 Komponen & Skema Wiring

Konfigurasi pin mikrokontroler ESP32 DevKit v1 pada proyek ini:

| Komponen | Tipe | Pin ESP32 | Keterangan |
| :--- | :--- | :--- | :--- |
| **DHT22** | Sensor Lingkungan | `GPIO 4` | Membaca Suhu Udara (°C) dan Kelembapan Relatif (%) |
| **MLX90614** | Sensor IR Non-Kontak | `GPIO 21` (SDA)<br>`GPIO 22` (SCL) | Membaca Suhu Permukaan Daun Tanaman Vanili (°C) via I2C |
| **SSD1306 OLED** | Layar 128x64 | `GPIO 21` (SDA)<br>`GPIO 22` (SCL) | Menampilkan status lokal, telemetri, dan menu navigasi (I2C: `0x3C`) |
| **Soil Potentiometer** | Sensor Analog | `GPIO 34` (ADC) | Simulasi kelembapan tanah / matriks hisap tanah |
| **LDR Photoresistor** | Sensor Analog | `GPIO 35` (ADC) | Membaca intensitas cahaya lingkungan (dikonversi ke satuan Lux) |
| **Push Button** | Input Digital | `GPIO 32` (PULLUP) | Navigasi menu OLED & reset akumulator (Hold 1 detik) |
| **Red LED Alert** | Indikator Visual | `GPIO 25` | Menyala saat level risiko **HIGH** |
| **Fan / Relay Module** | Aktuator Pendingin | `GPIO 26` | Mengontrol sirkulasi udara / *exhaust fan* |
| **Servo Motor** | Aktuator Mekanis | `GPIO 27` (PWM) | Mengatur sudut bukaan ventilasi greenhouse (0° - 90°) |

> 💡 *File [diagram.json](file:///c:/Users/LENOVO%20X1%20CARBON/Documents/project_web/web_iot/diagram.json) dapat dibuka langsung di simulator [Wokwi](https://wokwi.com) untuk menjalankan simulasi sirkuit tanpa hardware fisik.*

---

## 🧠 Algoritma & Model Risiko Jamur

### 1. Perhitungan Saturated Vapor Pressure (SVP) & VPD
Sistem menghitung tekanan uap jenuh menggunakan persamaan Tetens:
$$\text{SVP}(T) = 0.6108 \times \exp\left(\frac{17.27 \times T}{T + 237.3}\right)\quad (\text{kPa})$$

Tekanan uap aktual udara ($\text{AVP}$):
$$\text{AVP} = \text{SVP}(T_{\text{air}}) \times \left(\frac{\text{RH}}{100}\right)$$

Defisit Tekanan Uap / Vapor Pressure Deficit ($\text{VPD}$):
$$\text{VPD} = \text{SVP}(T_{\text{leaf}}) - \text{AVP}$$

### 2. Akumulasi Durasi & Ambang Risiko (Fungal Risk Model)
Spora jamur patogen (*Fusarium oxysporum*) memerlukan lapisan kondensasi air dan VPD yang sangat rendah dalam durasi waktu tertentu untuk berkecambah.
- **VPD Kritis**: $< 0.2\text{ kPa}$ (Laju akumulator bertambah $2\times$)
- **VPD Rendah**: $0.2\text{ kPa} \le \text{VPD} < 0.4\text{ kPa}$ (Laju akumulator bertambah $1\times$)
- **VPD Aman**: $\ge 0.4\text{ kPa}$ (Akumulator mengalami *decay* dengan pengali $1.5\times$)

| Akumulasi Durasi Rendah | Status Risiko | Respon Otomatis Aktuator |
| :--- | :--- | :--- |
| $< 5\text{ menit}$ | **LOW RISK** | Kipas: OFF, Ventilasi: 0° (Tertutup), LED Alert: OFF |
| $5\text{ s/d } 15\text{ menit}$ | **MEDIUM RISK** | Kipas: ON, Ventilasi: 45° (Buka Parsial), LED Alert: OFF |
| $\ge 15\text{ menit}$ | **HIGH RISK** | Kipas: ON, Ventilasi: 90° (Buka Penuh), LED Alert: ON |

*(Pada mode simulasi/demo, 1 unit waktu dipercepat menjadi 1 detik per menit untuk kemudahan pengujian).*

---

## 📡 Spesifikasi Komunikasi MQTT

- **Broker**: `broker.emqx.io` (Port `1883`)
- **Default Device ID**: `gh01`

### 1. Telemetri Sensor (`vanigrow/gh01/data`)
Dipublikasikan oleh ESP32 setiap 1 detik.
```json
{
  "device": "gh01",
  "air_temp": 28.4,
  "air_hum": 88.5,
  "leaf_temp": 27.9,
  "vpd": 0.18,
  "low_vpd_duration_min": 16.2,
  "soil": 120,
  "light": 1450,
  "risk_level": "HIGH",
  "fan": true,
  "vent": 90,
  "auto": true,
  "ts": 128450
}
```

### 2. Status Koneksi Device (`vanigrow/gh01/status`)
Menggunakan fitur *Last Will and Testament* (LWT) MQTT:
- Online: `"online"` (Retained)
- Offline: `"offline"` (Retained saat koneksi ESP32 terputus)

### 3. Kendali Dua Arah (`vanigrow/gh01/cmd`)
Dikirim dari dashboard web melalui endpoint `/api/cmd`:
```json
{
  "auto": false,
  "fan": true,
  "vent": 45
}
```

---

## 🗄 Skema Basis Data (Supabase)

Eksekusi kueri berikut pada **Supabase SQL Editor**:

```sql
-- 1. Tabel log sensor historis
create table if not exists sensor_logs (
  id           bigserial primary key,
  device_id    text        not null,
  air_temp     float,
  air_hum      float,
  leaf_temp    float,
  vpd          float,
  low_vpd_dur  float,
  soil         int,
  light        int,
  risk_level   text,
  fan          boolean,
  vent         int,
  auto_mode    boolean,
  ts_device    bigint,
  created_at   timestamptz not null default now()
);

create index if not exists idx_sensor_logs_device_time
  on sensor_logs (device_id, created_at desc);

-- 2. Tabel status online/offline device
create table if not exists device_status (
  device_id   text        primary key,
  status      text        not null default 'offline',
  updated_at  timestamptz not null default now()
);

-- 3. Row Level Security (RLS)
alter table sensor_logs enable row level security;
alter table device_status enable row level security;

create policy "anon select sensor_logs"
  on sensor_logs for select using (true);

create policy "service insert sensor_logs"
  on sensor_logs for insert with check (true);

create policy "anon select device_status"
  on device_status for select using (true);

create policy "service upsert device_status"
  on device_status for all using (true) with check (true);

-- 4. Aktifkan Realtime Publication
alter publication supabase_realtime add table sensor_logs;
alter publication supabase_realtime add table device_status;
```

---

## 🚀 Panduan Instalasi & Menjalankan

### 1. Firmware & Simulasi ESP32 (Wokwi)

1. Buka [Wokwi](https://wokwi.com) dan buat proyek baru dengan target **ESP32 DevKit v1**.
2. Salin isi [sketch.ino](file:///c:/Users/LENOVO%20X1%20CARBON/Documents/project_web/web_iot/sketch.ino) ke tab editor kode.
3. Salin isi [diagram.json](file:///c:/Users/LENOVO%20X1%20CARBON/Documents/project_web/web_iot/diagram.json) ke tab diagram sirkuit.
4. Pasang library yang dibutuhkan di Wokwi Library Manager:
   - `PubSubClient`
   - `DHT sensor library`
   - `Adafruit GFX Library`
   - `Adafruit SSD1306`
   - `Adafruit MLX90614 Library`
   - `ArduinoJson`
   - `ESP32Servo`
5. Jalankan simulasi. Mikrokontroler akan menghubungkan diri ke WiFi virtual dan MQTT broker `broker.emqx.io`.

---

### 2. Layanan Telemetry Bridge (Node.js)

Layanan ini menjembatani aliran data MQTT menuju basis data Supabase:

```bash
# Masuk ke folder bridge
cd bridge

# Instal dependensi
npm install

# Buat file konfigurasi .env
cp .env.example .env
```

Sesuaikan isi `.env` dengan kredensial Supabase Anda:
```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_KEY=<your-supabase-service-role-key>
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_CLIENT_ID=vanigrow-bridge-prod
PORT=4000
```

Jalankan bridge:
```bash
node index.js
```

---

### 3. Web Dashboard (Next.js 16)

```bash
# Masuk ke direktori dashboard
cd dashboard

# Instal dependensi
npm install
```

Pastikan file `dashboard/.env.local` terisi:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_CLIENT_ID=vanigrow-dashboard-cmd
```

Jalankan server pengembangan:
```bash
npm run dev
```

Buka peramban di: **[http://localhost:3000](http://localhost:3000)**.

---

## ✨ Fitur Utama Dashboard

1. **Live Microclimate Monitoring**: Tampilan real-time metrik Suhu Udara, Kelembapan Udara, Suhu Daun (IR), VPD, Kelembapan Media Tanam, dan Intensitas Cahaya (Lux).
2. **Dynamic Risk Badge**: Indikator visual pintar level risiko jamur (*Low*, *Medium*, *High*) dengan panduan tindakan lapangan.
3. **Interactive Charts**: Grafik time-series historis dengan *smooth interpolation* (Recharts) untuk memantau fluktuasi VPD dan mikroklimat.
4. **Remote Actuator Control**:
   - Kemampuan beralih antara mode **AUTO** (dikendalikan algoritma risiko) dan **MANUAL**.
   - Saklar daya Kipas / Exhaust Dehumidifier.
   - Slider pengaturan sudut servo ventilasi dari **0° (Tertutup)** hingga **90° (Terbuka Penuh)**.
5. **Pelaporan & Audit**:
   - **Download CSV**: Unduh seluruh riwayat data telemetri berdasarkan rentang tanggal yang dipilih.
   - **Download PDF**: Pembuatan dokumen laporan harian resmi insiden risiko jamur per jam menggunakan `jspdf` dan `jspdf-autotable`.
6. **Dark & Light Mode**: Desain antarmuka responsif dan ramah mata untuk penggunaan lapangan baik di siang maupun malam hari.

---

## ☁️ Panduan Deployment Cloud

- **Bridge Service**: Siap di-deploy ke **Railway**, **Render**, atau **Glitch** via [Procfile](file:///c:/Users/LENOVO%20X1%20CARBON/Documents/project_web/web_iot/bridge/Procfile). Bridge sudah dilengkapi dengan dummy HTTP listener di port `$PORT` untuk memenuhi persyaratan *Health Check* platform PaaS gratis.
- **Web Dashboard**: Siap di-deploy secara *one-click* ke **Vercel** dengan menambahkan environment variable `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

<p align="center">
  <b>VaniGrow Monitoring System</b> — Melindungi Tunas & Batang Vanili dari Risiko Jamur dengan IoT Presisi.
</p>
