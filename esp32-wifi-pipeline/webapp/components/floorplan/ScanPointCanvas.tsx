"use client";

import { useRef, useState } from "react";
import { createScanPoint, updateScanPoint } from "@/lib/api";
import type { ScanPoint } from "@/lib/api";
import { useImageBounds, toPixel, toNorm } from "@/lib/useImageBounds";
import { useZoomPan } from "@/lib/useZoomPan";

interface Props {
  floorplanId: number;
  floorplanImageUrl: string;
  scanPoints: ScanPoint[];
  selectedPointId: number | null;
  onPointCreated: (pt: ScanPoint) => void;
  onPointSelected: (pt: ScanPoint | null) => void;
  onPointUpdated:  (pt: ScanPoint) => void;
  onPointDeleted:  (id: number) => void;
}

export default function ScanPointCanvas({
  floorplanId,
  floorplanImageUrl,
  scanPoints,
  selectedPointId,
  onPointCreated,
  onPointSelected,
  onPointUpdated,
  onPointDeleted,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const [placing,  setPlacing]  = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragPos,  setDragPos]  = useState<Record<number, { x: number; y: number }>>({});

  const bounds = useImageBounds(containerRef, imgRef);
  const { transform, zoomIn, zoomOut, reset, handleMouseDown, toInner } = useZoomPan(containerRef);

  // ── Click on canvas → place new pin ────────────────────────────────────────
  async function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragging !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const inner = toInner(e.clientX - rect.left, e.clientY - rect.top);
    const x = bounds ? toNorm(inner.x, bounds.offsetX, bounds.renderedW) : inner.x / rect.width;
    const y = bounds ? toNorm(inner.y, bounds.offsetY, bounds.renderedH) : inner.y / rect.height;

    setPlacing(true);
    try {
      const pt = await createScanPoint(floorplanId, x, y);
      onPointCreated(pt);
    } catch (err) { console.error(err); }
    finally { setPlacing(false); }
  }

  // ── Drag a pin to reposition ────────────────────────────────────────────────
  function handlePinMouseDown(e: React.MouseEvent, pt: ScanPoint) {
    e.stopPropagation();
    setDragging(pt.id);
    onPointSelected(pt);

    const container = containerRef.current;
    if (!container) return;

    function onMove(me: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      const inner = toInner(me.clientX - rect.left, me.clientY - rect.top);
      const x = bounds ? toNorm(inner.x, bounds.offsetX, bounds.renderedW) : Math.min(1, Math.max(0, inner.x / rect.width));
      const y = bounds ? toNorm(inner.y, bounds.offsetY, bounds.renderedH) : Math.min(1, Math.max(0, inner.y / rect.height));
      setDragPos(prev => ({ ...prev, [pt.id]: { x, y } }));
    }

    async function onUp(me: MouseEvent) {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      setDragging(null);
      setDragPos(prev => { const n = { ...prev }; delete n[pt.id]; return n; });

      const rect = container!.getBoundingClientRect();
      const inner = toInner(me.clientX - rect.left, me.clientY - rect.top);
      const x = bounds ? toNorm(inner.x, bounds.offsetX, bounds.renderedW) : Math.min(1, Math.max(0, inner.x / rect.width));
      const y = bounds ? toNorm(inner.y, bounds.offsetY, bounds.renderedH) : Math.min(1, Math.max(0, inner.y / rect.height));
      try {
        const updated = await updateScanPoint(pt.id, { x, y });
        onPointUpdated(updated);
      } catch (err) { console.error(err); }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }

  const displayPoints = scanPoints.map(p =>
    dragPos[p.id] ? { ...p, ...dragPos[p.id] } : p
  );

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      style={{
        position: "relative", flex: 1,
        cursor: placing ? "crosshair" : "crosshair",
        userSelect: "none", borderRadius: 10,
        overflow: "hidden", background: "#0a1628",
      }}
    >
      {/* ── Transform wrapper (image + pins move together) ── */}
      <div style={{
        width: "100%", height: "100%",
        transform, transformOrigin: "0 0",
        willChange: "transform", position: "relative",
      }}>
        <img
          ref={imgRef}
          src={floorplanImageUrl}
          alt="Floor plan"
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }}
        />

        {/* Pins */}
        {displayPoints.map(pt => {
          const isSelected = pt.id === selectedPointId;
          const isDragging = pt.id === dragging;
          const left = bounds ? toPixel(pt.x, bounds.offsetX, bounds.renderedW) : `${pt.x * 100}%`;
          const top  = bounds ? toPixel(pt.y, bounds.offsetY, bounds.renderedH) : `${pt.y * 100}%`;
          return (
            <div
              key={pt.id}
              onMouseDown={e => handlePinMouseDown(e, pt)}
              onClick={e => { e.stopPropagation(); onPointSelected(pt); }}
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, -100%)",
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: isSelected ? 20 : 10,
                transition: isDragging ? "none" : "left 0.1s, top 0.1s",
              }}
            >
              <div style={{
                width:  isSelected ? 22 : 16,
                height: isSelected ? 22 : 16,
                borderRadius: "50% 50% 50% 0",
                transform: "rotate(-45deg)",
                background: isSelected
                  ? "#3b82f6"
                  : pt.assigned_node ? "#22c55e" : "#64748b",
                borderWidth: 2,
                borderStyle: "solid",
                borderColor: isSelected ? "#93c5fd" : "rgba(255,255,255,0.3)",
                boxShadow: isSelected
                  ? "0 0 14px rgba(59,130,246,0.7)"
                  : pt.assigned_node ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                transition: "all 0.15s",
              }} />
              {pt.label && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 4px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(15,25,41,0.92)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 5,
                  padding: "2px 6px",
                  fontSize: "0.65rem",
                  color: "#94a3b8",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}>
                  {pt.label}
                </div>
              )}
            </div>
          );
        })}
      </div>{/* end transform wrapper */}

      {/* ── Zoom controls (fixed overlay, not affected by transform) ── */}
      <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 4, zIndex: 30 }}>
        {[
          { icon: "⊕", title: "Zoom in",     action: zoomIn  },
          { icon: "⊖", title: "Zoom out",    action: zoomOut },
          { icon: "⛶", title: "Reset zoom",  action: reset   },
        ].map(({ icon, title, action }) => (
          <button
            key={title}
            title={title}
            onClick={e => { e.stopPropagation(); action(); }}
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: "rgba(13,22,38,0.88)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              cursor: "pointer", fontSize: "0.9rem",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#94a3b8",
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {scanPoints.length === 0 && !placing && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(15,25,41,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.6rem 1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            Click anywhere on the map to place a scan point
          </div>
        </div>
      )}
    </div>
  );
}
