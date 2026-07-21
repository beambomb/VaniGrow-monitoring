import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deviceId = 'gh01', ...cmd } = body;

    const topic = `vanigrow/${deviceId}/cmd`;
    const payload = JSON.stringify(cmd);

    await new Promise<void>((resolve, reject) => {
      const client = mqtt.connect('mqtt://broker.emqx.io:1883', {
        clientId: `${process.env.MQTT_CLIENT_ID || 'vanigrow-dashboard'}-${Date.now()}`,
        connectTimeout: 5000,
      });
      client.on('connect', () => {
        client.publish(topic, payload, { qos: 1 }, (err) => {
          client.end();
          if (err) reject(err);
          else resolve();
        });
      });
      client.on('error', reject);
    });

    return NextResponse.json({ ok: true, topic, payload });
  } catch (err: any) {
    console.error('[CMD API]', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
