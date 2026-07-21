import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type SensorLog = {
  id: number;
  device_id: string;
  air_temp: number;
  air_hum: number;
  leaf_temp: number;
  vpd: number;
  low_vpd_dur: number;
  soil: number;
  light: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  fan: boolean;
  vent: number;
  auto_mode: boolean;
  ts_device: number;
  created_at: string;
};

export type DeviceStatus = {
  device_id: string;
  status: 'online' | 'offline';
  updated_at: string;
};
