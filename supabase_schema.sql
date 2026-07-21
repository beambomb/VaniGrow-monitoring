-- ============================================================
-- VaniGrow — Supabase Schema
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabel log sensor (append-only, ~1 row per 3 detik per device)
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

-- 2. Tabel status device (satu row per device, di-upsert)
create table if not exists device_status (
  device_id   text        primary key,
  status      text        not null default 'offline',
  updated_at  timestamptz not null default now()
);

-- 3. RLS: anon bisa baca, service_role bisa insert/upsert
alter table sensor_logs  enable row level security;
alter table device_status enable row level security;

create policy "anon select sensor_logs"
  on sensor_logs for select using (true);

create policy "service insert sensor_logs"
  on sensor_logs for insert
  with check (true);

create policy "anon select device_status"
  on device_status for select using (true);

create policy "service upsert device_status"
  on device_status for all
  using (true) with check (true);

-- 4. Enable Realtime untuk dashboard subscription
alter publication supabase_realtime add table sensor_logs;
alter publication supabase_realtime add table device_status;
