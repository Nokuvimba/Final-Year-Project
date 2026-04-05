import { API_BASE, handleJson } from "./http";

export type TimeRange = "20m" | "1h" | "6h" | "24h" | "7d";

export type Dht22Reading = {
  received_at:   string;
  temperature_c: number;
  humidity_pct:  number;
};

type WifiHistoryResponse = {
  buckets: import("./types").WifiHistoryBucket[];
};

type Dht22HistoryResponse = {
  readings: Dht22Reading[];
};

export async function fetchWifiHistory(
  scanPointId: number,
  range: TimeRange = "20m"
): Promise<import("./types").WifiHistoryBucket[]> {
  const res = await fetch(
    `${API_BASE}/scan-points/${scanPointId}/wifi-history?time_range=${range}`,
    { cache: "no-store" }
  );
  const data = await handleJson<WifiHistoryResponse>(res);
  return data.buckets ?? [];
}

export async function fetchDht22History(
  scanPointId: number,
  time_range = "24h"
): Promise<Dht22Reading[]> {
  const res = await fetch(
    `${API_BASE}/scan-points/${scanPointId}/dht22-history?time_range=${time_range}`,
    { cache: "no-store" }
  );
  const data = await handleJson<Dht22HistoryResponse>(res);
  return data.readings ?? [];
}
