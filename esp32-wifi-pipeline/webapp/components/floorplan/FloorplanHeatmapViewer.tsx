"use client";

import { useEffect, useState, useRef } from "react";
import { fetchFloorplanHeatmap, getImageUrl, type HeatmapPoint } from "@/lib/api";

interface FloorplanHeatmapViewerProps {
  floorplanId: number;
  floorplanImageUrl: string;
  readOnly: boolean;
  onRoomClick?: (roomId: number) => void;
}

function getHeatColor(level: string | null): string {
  switch (level) {
    case "strong": return "rgba(0, 255, 0, 0.5)";
    case "medium": return "rgba(255, 255, 0, 0.5)";
    case "low": return "rgba(255, 165, 0, 0.5)";
    case "weak": return "rgba(255, 0, 0, 0.5)";
    default: return "rgba(128, 128, 128, 0.3)";
  }
}

export default function FloorplanHeatmapViewer({
  floorplanId,
  floorplanImageUrl,
  readOnly,
  onRoomClick
}: FloorplanHeatmapViewerProps) {
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<HeatmapPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    loadHeatmap();
  }, [floorplanId]);

  async function loadHeatmap() {
    try {
      const heatmap = await fetchFloorplanHeatmap(floorplanId);
      setHeatmapData(heatmap);
    } catch (err) {
      console.error('Failed to load heatmap:', err);
    }
  }

  function handleHeatMarkerClick(point: HeatmapPoint) {
    if (readOnly && onRoomClick) {
      onRoomClick(point.room_id);
    }
  }

  function handleMouseEnter(point: HeatmapPoint, event: React.MouseEvent) {
    setHoveredPoint(point);
    updateTooltipPosition(event);
  }

  function handleMouseMove(event: React.MouseEvent) {
    if (hoveredPoint) {
      updateTooltipPosition(event);
    }
  }

  function updateTooltipPosition(event: React.MouseEvent) {
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <img
          ref={imgRef}
          src={getImageUrl(floorplanImageUrl)}
          alt="Floor plan"
          className="floorplan-image"
          style={{ width: '100%', display: 'block' }}
        />

        {/* Heat Markers */}
        {heatmapData.map((point) => (
          point.x !== null && point.y !== null && (
            <div
              key={`heat-${point.room_id}`}
              onMouseEnter={(e) => handleMouseEnter(point, e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={() => handleHeatMarkerClick(point)}
              style={{
                position: 'absolute',
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: '140px',
                height: '140px',
                cursor: readOnly ? 'pointer' : 'default',
                pointerEvents: readOnly ? 'auto' : 'none'
              }}
            >
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: getHeatColor(point.level),
                filter: 'blur(10px)',
                pointerEvents: 'none'
              }} />
            </div>
          )
        ))}
      </div>

      {/* Tooltip */}
      {hoveredPoint && (
        <div style={{
          position: 'fixed',
          left: `${tooltipPos.x + 10}px`,
          top: `${tooltipPos.y + 10}px`,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{hoveredPoint.room_name}</div>
          <div>Avg RSSI: {hoveredPoint.avg_rssi !== null ? `${hoveredPoint.avg_rssi.toFixed(1)} dBm` : 'N/A'}</div>
          <div>Samples: {hoveredPoint.samples}</div>
        </div>
      )}

      {/* Signal Legend */}
      <div style={{
        marginTop: '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        color: '#000'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Signal Strength</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{
              height: '20px',
              flex: 1,
              minWidth: '200px',
              background: 'linear-gradient(to right, rgba(255, 0, 0, 0.7), rgba(255, 165, 0, 0.7), rgba(255, 255, 0, 0.7), rgba(0, 255, 0, 0.7))',
              borderRadius: '10px'
            }} />
            <div style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              Strong (green) = -50 dBm or better • Medium (yellow) = -50 to -60 dBm • Low (orange) = -60 to -70 dBm • Weak (red) = below -70 dBm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
