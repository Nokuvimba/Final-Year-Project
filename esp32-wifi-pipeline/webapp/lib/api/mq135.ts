// lib/api/mq135.ts
// MQ-135 air quality sensor API functions.
//  re-exports from lib/api.ts.
// Uses FastAPI directly (not the Next.js /api proxy) to avoid
// Turbopack route resolution issues seen with dht22-history.
 
export { fetchMq135History, fetchMq135Heatmap } from "../api";
export type { Mq135Reading, Mq135HeatmapPoint } from "../api";
 