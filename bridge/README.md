# 🌉 MQTT → Supabase Ingestion Bridge

Layanan latar belakang (*background service*) Node.js yang bertugas mengonsumsi paket telemetri dari MQTT Broker dan menyimpannya secara *real-time* ke database PostgreSQL Supabase.

---

## ⚙️ Cara Kerja

1. **MQTT Subscription**:
   - Berlangganan topik data: `vanigrow/+/data` (QoS 1)
   - Berlangganan topik status: `vanigrow/+/status` (QoS 1)
2. **Payload Processing**:
   - Memvalidasi dan mem-parsing data JSON dari ESP32.
   - Melakukan normalisasi dan kalibrasi rumus LDR / Lux jika diperlukan.
3. **Database Insertion**:
   - Memasukkan rekaman sensor ke tabel `sensor_logs`.
   - Meng-*upsert* status dan waktu keaktifan terakhir perangkat ke tabel `device_status`.
4. **Heartbeat Watchdog**:
   - Memeriksa secara berkala (setiap 30 detik).
   - Menandai perangkat sebagai `offline` secara otomatis jika tidak mengirim data selama lebih dari 2 menit.
5. **Dummy HTTP Server**:
   - Membuka port HTTP (default `4000` atau `process.env.PORT`) untuk memenuhi syarat *health check* pada layanan PaaS gratis (Render / Railway / Glitch).

---

## 🚀 Setup & Menjalankan

### 1. Instalasi

```bash
npm install
```

### 2. Konfigurasi Lingkungan (`.env`)

Salin dari contoh:
```bash
cp .env.example .env
```

Isi variabel konfigurasi:
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>

MQTT_BROKER=mqtt://broker.emqx.io:1883
MQTT_CLIENT_ID=vanigrow-bridge-prod
PORT=4000
```

> ⚠️ **Catatan Penting**: Gunakan **`SUPABASE_SERVICE_KEY`** (service role key), bukan anon key, agar bridge dapat melakukan penulisan (*insert* dan *upsert*) melewati batasan Row Level Security (RLS).

### 3. Menjalankan Bridge

```bash
node index.js
```

---

## ☁️ Deployment Cloud

- **Render / Railway**: Auto-detect Node.js via `Procfile` (`web: node index.js`). Pastikan mengatur seluruh *Environment Variables* di dashboard layanan.
- **Glitch**: Dapat dijalankan melalui root `package.json` (`npm start`).
