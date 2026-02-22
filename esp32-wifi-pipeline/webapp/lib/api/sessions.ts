import { API_BASE, handleJson } from "./http";
import type { ScanSession } from "./types";

export async function fetchScanSessions(): Promise<ScanSession[]> {
  const res = await fetch(`${API_BASE}/sessions`, { cache: "no-store" });
  const data = await handleJson<{ sessions: ScanSession[] }>(res);
  return data.sessions ?? [];
}
