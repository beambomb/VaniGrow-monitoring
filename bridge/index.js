require('dotenv').config();
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key: bypass RLS
);

const mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883', {
  clientId: process.env.MQTT_CLIENT_ID || `vanigrow-bridge-${Date.now()}`,
  keepalive: 60,
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

mqttClient.on('connect', () => {
  console.log(`[MQTT] Connected to ${process.env.MQTT_BROKER}`);
  mqttClient.subscribe('vanigrow/+/data',   { qos: 1 });
  mqttClient.subscribe('vanigrow/+/status', { qos: 1 });
  console.log('[MQTT] Subscribed to vanigrow/+/data and vanigrow/+/status');
});

mqttClient.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
mqttClient.on('error', (err) => console.error('[MQTT] Error:', err.message));

// ── Message Handler ───────────────────────────────────────────────────────────
mqttClient.on('message', async (topic, payload) => {
  const parts = topic.split('/'); // ['vanigrow', 'gh01', 'data']
  const deviceId = parts[1];
  const msgType  = parts[2];

  // Status topic kirim plain text, bukan JSON
  if (msgType === 'status') {
    await handleStatus(deviceId, payload.toString());
    return;
  }

  let data;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    console.warn(`[BRIDGE] Failed to parse payload on ${topic}`);
    return;
  }

  if (msgType === 'data') {
    await handleSensorData(deviceId, data);
  }
});

// ── Sensor Data Insert ────────────────────────────────────────────────────────
async function handleSensorData(deviceId, d) {
  const row = {
    device_id:   deviceId,
    air_temp:    d.air_temp    ?? null,
    air_hum:     d.air_hum    ?? null,
    leaf_temp:   d.leaf_temp   ?? null,
    vpd:         d.vpd         ?? null,
    low_vpd_dur: d.low_vpd_duration_min ?? null,
    soil:        d.soil        ?? null,
    light:       d.light       ?? null,
    risk_level:  d.risk_level  ?? null,
    fan:         d.fan         ?? null,
    vent:        d.vent        ?? null,
    auto_mode:   d.auto        ?? null,
    ts_device:   d.ts          ?? null,
  };

  const { error } = await supabase.from('sensor_logs').insert(row);
  if (error) {
    console.error('[Supabase] Insert error:', error.message);
  } else {
    console.log(`[Supabase] Inserted | device=${deviceId} vpd=${d.vpd?.toFixed(3)} risk=${d.risk_level}`);
  }

  // Upsert device_status agar dashboard tahu device online
  await supabase.from('device_status').upsert({
    device_id:  deviceId,
    status:     'online',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'device_id' });
}

// ── Status Handler ────────────────────────────────────────────────────────────
async function handleStatus(deviceId, status) {
  console.log(`[MQTT] Status | device=${deviceId} status=${status}`);
  const { error } = await supabase.from('device_status').upsert({
    device_id:  deviceId,
    status:     status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'device_id' });
  if (error) console.error('[Supabase] Upsert error:', error.message);
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
// Mark device offline jika tidak ada data lebih dari 30 detik
setInterval(async () => {
  const cutoff = new Date(Date.now() - 120_000).toISOString(); // 2 menit cutoff
  await supabase
    .from('device_status')
    .update({ status: 'offline' })
    .lt('updated_at', cutoff)
    .eq('status', 'online');
}, 30_000);

console.log('[Bridge] VaniGrow MQTT→Supabase bridge started');
