"use client";

import { useState, useEffect } from "react";
import { fetchAlerts, type Alert } from "@/lib/api";

export function useAlerts(intervalMs = 30_000) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchAlerts();
        if (!cancelled) setAlerts(data);
      } catch {
        // Server may be offline — silently ignore
      }
    }

    load();
    const id = setInterval(load, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);

  return alerts;
}
