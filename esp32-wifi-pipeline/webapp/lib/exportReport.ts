/**
 * Export utilities for the MSSIA report.
 *
 * collectExportData  — fetch all sensor readings for a floor plan and join them
 *                      to the scan-point list from the admin studio state.
 * exportCSV          — download a comma-separated file to the browser.
 * exportPPTX         — generate and download a .pptx slide deck (pptxgenjs,
 *                      dynamically imported so it never runs on the server).
 */

import type { ScanPoint, HeatmapPoint, Dht22HeatmapPoint, Mq135HeatmapPoint } from "@/lib/api";
import { fetchFloorplanHeatmap, fetchDht22Heatmap, fetchMq135Heatmap } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExportRow {
  index:        number;
  label:        string;
  assignedNode: string;
  signalLevel:  string;
  avgRssi:      string;
  tempC:        string;
  humidityPct:  string;
  airQuality:   string;
}

// ── Data collection ────────────────────────────────────────────────────────────

export async function collectExportData(
  floorplanId: number,
  scanPoints:  ScanPoint[],
): Promise<ExportRow[]> {
  const [heatmap, dht22, mq135] = await Promise.all([
    fetchFloorplanHeatmap(floorplanId).catch(() => [] as HeatmapPoint[]),
    fetchDht22Heatmap(floorplanId).catch(() => []    as Dht22HeatmapPoint[]),
    fetchMq135Heatmap(floorplanId).catch(() => []    as Mq135HeatmapPoint[]),
  ]);

  return scanPoints.map((pt, i) => {
    const h = heatmap.find(h => h.room_id === pt.id);
    const d = dht22.find(d  => d.scan_point_id === pt.id);
    const m = mq135.find(m  => m.scan_point_id === pt.id);

    return {
      index:        i + 1,
      label:        pt.label ?? `Point ${pt.id}`,
      assignedNode: pt.assigned_node ?? "—",
      signalLevel:  h?.level   ? capitalize(h.level)        : "—",
      avgRssi:      h?.avg_rssi != null ? `${h.avg_rssi.toFixed(1)} dBm` : "—",
      tempC:        d?.temperature_c != null ? `${d.temperature_c.toFixed(1)} °C` : "—",
      humidityPct:  d?.humidity_pct  != null ? `${d.humidity_pct.toFixed(1)} %`   : "—",
      airQuality:   m?.air_level ? capitalize(m.air_level)  : "—",
    };
  });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── CSV export ─────────────────────────────────────────────────────────────────

export function exportCSV(rows: ExportRow[], buildingName: string, floorName: string) {
  const headers = ["#", "Label", "Assigned Device", "Signal Level", "Avg RSSI", "Temp", "Humidity", "Air Quality"];
  const lines   = [
    headers.join(","),
    ...rows.map(r =>
      [
        r.index,
        csvCell(r.label),
        csvCell(r.assignedNode),
        r.signalLevel,
        r.avgRssi,
        r.tempC,
        r.humidityPct,
        r.airQuality,
      ].join(",")
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `MSSIA_${slug(buildingName)}_${slug(floorName)}_${dateStamp()}.csv`);
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

// ── PPTX export ────────────────────────────────────────────────────────────────

export async function exportPPTX(rows: ExportRow[], buildingName: string, floorName: string) {
  // Dynamic import keeps pptxgenjs out of the SSR bundle.
  const pptxgen = (await import("pptxgenjs")).default;
  const prs = new pptxgen();
  prs.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in

  // ── Slide 1: Title ──────────────────────────────────────────────────────────
  const s1 = prs.addSlide();
  s1.background = { color: "0a1628" };

  // Accent bar
  s1.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: "2563eb" } });

  s1.addText("MSSIA", {
    x: 0.5, y: 1.6, w: 12, h: 0.8,
    fontSize: 42, bold: true, color: "f1f5f9", fontFace: "Segoe UI",
  });
  s1.addText("Indoor Analytics Report", {
    x: 0.5, y: 2.4, w: 12, h: 0.55,
    fontSize: 22, color: "60a5fa", fontFace: "Segoe UI",
  });

  s1.addText(`${buildingName}  ›  ${floorName}`, {
    x: 0.5, y: 3.25, w: 12, h: 0.42,
    fontSize: 16, color: "94a3b8", fontFace: "Segoe UI",
  });
  s1.addText(`Generated ${new Date().toLocaleString("en-IE", { dateStyle: "long", timeStyle: "short" })}`, {
    x: 0.5, y: 3.75, w: 12, h: 0.35,
    fontSize: 12, color: "475569", fontFace: "Segoe UI",
  });

  // Summary stats
  const assigned = rows.filter(r => r.assignedNode !== "—").length;
  const stats = [
    { label: "Scan Points",     value: String(rows.length)   },
    { label: "Assigned Devices", value: String(assigned)     },
    { label: "Unassigned",       value: String(rows.length - assigned) },
  ];
  stats.forEach((st, i) => {
    const x = 0.5 + i * 2.8;
    s1.addShape(prs.ShapeType.rect, { x, y: 5.2, w: 2.5, h: 1.1, fill: { color: "0f172a" }, line: { color: "1e3a5f", width: 1 } });
    s1.addText(st.value, { x, y: 5.22, w: 2.5, h: 0.55, align: "center", fontSize: 28, bold: true, color: "f1f5f9", fontFace: "Segoe UI" });
    s1.addText(st.label,  { x, y: 5.75, w: 2.5, h: 0.35, align: "center", fontSize: 10, color: "64748b",  fontFace: "Segoe UI" });
  });

  // ── Slide 2: Scan Point Table ───────────────────────────────────────────────
  const s2 = prs.addSlide();
  s2.background = { color: "ffffff" };

  // Header band
  s2.addShape(prs.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.0, fill: { color: "0a1628" } });
  s2.addText(`Scan Point Details  —  ${buildingName} › ${floorName}`, {
    x: 0.35, y: 0.15, w: 10, h: 0.45,
    fontSize: 16, bold: true, color: "f1f5f9", fontFace: "Segoe UI",
  });
  s2.addText(`${rows.length} points · ${dateStamp()}`, {
    x: 0.35, y: 0.6, w: 10, h: 0.28,
    fontSize: 9, color: "64748b", fontFace: "Segoe UI",
  });

  // Table
  type PptxCell = { text: string; options?: object };
  const HDR: PptxCell[] = [
    "#", "Label", "Device", "Signal", "RSSI", "Temp", "Humidity", "Air Quality",
  ].map(t => ({ text: t, options: { bold: true, color: "f1f5f9", fill: { color: "1e3a5f" }, fontSize: 9, fontFace: "Segoe UI", valign: "middle", align: "center" } }));

  const dataRows: PptxCell[][] = rows.map(r => {
    const sigColor  = signalHex(r.signalLevel);
    const airColor  = airHex(r.airQuality);
    const cell = (text: string, extra?: object): PptxCell => ({ text, options: { fontSize: 8.5, fontFace: "Segoe UI", valign: "middle", color: "1e293b", ...extra } });
    return [
      cell(String(r.index),    { align: "center" }),
      cell(r.label),
      cell(r.assignedNode,     { color: r.assignedNode === "—" ? "9ca3af" : "0f172a" }),
      cell(r.signalLevel,      { align: "center", bold: r.signalLevel !== "—", color: sigColor }),
      cell(r.avgRssi,          { align: "center", fontFace: "Courier New" }),
      cell(r.tempC,            { align: "center" }),
      cell(r.humidityPct,      { align: "center" }),
      cell(r.airQuality,       { align: "center", bold: r.airQuality !== "—", color: airColor }),
    ];
  });

  s2.addTable([HDR, ...dataRows], {
    x: 0.25, y: 1.15, w: 12.83,
    rowH: 0.32,
    border: { type: "solid", color: "e2e8f0", pt: 0.5 },
    fill: { color: "ffffff" },
    colW: [0.45, 2.5, 2.1, 1.1, 1.3, 1.0, 1.1, 1.28],
  });

  await prs.writeFile({ fileName: `MSSIA_${slug(buildingName)}_${slug(floorName)}_${dateStamp()}.pptx` });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function signalHex(level: string): string {
  return level === "Strong" ? "16a34a" : level === "Medium" ? "2563eb" : level === "Low" ? "d97706" : level === "Weak" ? "dc2626" : "6b7280";
}

function airHex(level: string): string {
  return level === "Good" ? "16a34a" : level === "Moderate" ? "d97706" : level === "Poor" ? "dc2626" : "6b7280";
}

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
}

function dateStamp() {
  return new Date().toISOString().split("T")[0];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
