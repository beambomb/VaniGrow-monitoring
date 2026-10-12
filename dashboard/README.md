# 🌿 VaniGrow Web Dashboard

Dashboard pemantauan mikroklimat dan kontrol jarak jauh (*remote control*) sistem IoT VaniGrow berbasis **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, dan **Supabase**.

---

## 🚀 Fitur

- **Live Sensor Telemetry**: Memantau Suhu Udara, Kelembapan, Suhu Daun (IR MLX90614), VPD (kPa), Kelembapan Tanah, dan Intensitas Cahaya (Lux).
- **Status Risiko Jamur**: Indikator dinamis (*LOW*, *MEDIUM*, *HIGH*) berdasarkan model akumulasi durasi VPD rendah.
- **Grafik Time-Series (Recharts)**: Visualisasi tren telemetri hingga 120 titik data terakhir.
- **Kendali Aktuator Jarak Jauh (Two-way MQTT)**:
  - Toggle mode **AUTO** / **MANUAL**.
  - Saklar manual Fan / Dehumidifier.
  - Pengatur sudut ventilasi (Servo 0° s/d 90°).
  - Mengirim perintah via MQTT ke broker melalui endpoint API internal `/api/cmd`.
- **Ekspor & Pelaporan**:
  - Download dataset mentah format **CSV** berdasarkan filter rentang tanggal.
  - Generate dokumen laporan harian resmi **PDF** berisikan statistik insiden kritis per jam menggunakan `jspdf` dan `jspdf-autotable`.
- **Mode Gelap / Terang**: Dukungan tema `next-themes` dengan styling modern.

---

## 📦 Menjalankan Secara Lokal

### 1. Instal Dependensi

```bash
npm install
```

### 2. Konfigurasi Lingkungan (`.env.local`)

Buat atau periksa file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_CLIENT_ID=vanigrow-dashboard-cmd
```

### 3. Jalankan Development Server

```bash
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## 🗂 Struktur File Dashboard

```
dashboard/
├── src/
│   ├── app/
│   │   ├── api/cmd/route.ts      # API Endpoint POST untuk kirim perintah MQTT
│   │   ├── globals.css           # Konfigurasi Tailwind CSS v4 & theme tokens
│   │   ├── layout.tsx            # Root layout web dengan ThemeProvider
│   │   └── page.tsx              # Halaman utama visualisasi monitoring & kontrol
│   ├── components/
│   │   ├── DeviceControl.tsx     # Komponen kontrol aktuator (Auto/Fan/Ventilasi)
│   │   ├── ReportModal.tsx       # Modal unduh CSV & cetak laporan PDF
│   │   ├── RiskBadge.tsx         # Badge status risiko jamur
│   │   ├── SensorCard.tsx        # Kartu ringkasan metrik sensor
│   │   ├── TimeSeriesChart.tsx   # Grafik interaktif data historis sensor
│   │   ├── ThemeProvider.tsx     # Provider context tema gelap/terang
│   │   └── ThemeToggle.tsx       # Tombol pengubah tema
│   └── lib/
│       └── supabase.ts           # Client Supabase & deklarasi TypeScript types
```

---

## ☁️ Deployment ke Vercel

Proyek ini siap di-deploy langsung ke Vercel:
1. Hubungkan repositori GitHub ke akun Vercel Anda.
2. Tetapkan **Root Directory** ke `dashboard`.
3. Masukkan Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Tekan **Deploy**.
