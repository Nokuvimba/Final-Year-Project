"use client";

import { useState, useEffect, useCallback, useRef, RefObject } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;

export function useZoomPan(containerRef: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  const [panX,  setPanX]  = useState(0);
  const [panY,  setPanY]  = useState(0);

  // Keep a ref to the latest state so drag/wheel closures never go stale.
  const state = useRef({ scale: 1, panX: 0, panY: 0 });
  state.current = { scale, panX, panY };

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    setScale(prev => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      const ratio = next / prev;
      setPanX(px => cx - ratio * (cx - px));
      setPanY(py => cy - ratio * (cy - py));
      return next;
    });
  }, []);

  // Non-passive wheel listener — required to call preventDefault and block page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, zoomAt]);

  // Middle-mouse-button drag to pan.
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.button !== 1) return;
    e.preventDefault();
    let lastX = e.clientX;
    let lastY = e.clientY;
    function onMove(me: MouseEvent) {
      setPanX(px => px + me.clientX - lastX);
      setPanY(py => py + me.clientY - lastY);
      lastX = me.clientX;
      lastY = me.clientY;
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, []);

  const zoomIn = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAt(width / 2, height / 2, 1.3);
  }, [containerRef, zoomAt]);

  const zoomOut = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    zoomAt(width / 2, height / 2, 1 / 1.3);
  }, [containerRef, zoomAt]);

  const reset = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  /**
   * Convert a pointer position that is relative to the outer container into
   * the inner div's CSS coordinate space (i.e. pre-transform coords).
   * Always reads from the ref so it is safe to call from stale closures.
   */
  function toInner(containerX: number, containerY: number) {
    const { scale: s, panX: px, panY: py } = state.current;
    return {
      x: (containerX - px) / s,
      y: (containerY - py) / s,
    };
  }

  const transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

  return { scale, panX, panY, transform, zoomIn, zoomOut, reset, handleMouseDown, toInner };
}
