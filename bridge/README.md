# MQTT → Supabase Bridge

Subscribe ke `vanigrow/+/data` dan `vanigrow/+/status` di HiveMQ,
insert ke Supabase PostgreSQL setiap ada pesan masuk.

## Setup

```bash
npm install
cp .env.example .env
# isi .env dengan Supabase credentials
node index.js
```

## Deploy Railway

Push repo ke GitHub, Railway auto-detect Node.js via Procfile.
Set environment variables di Railway dashboard.
