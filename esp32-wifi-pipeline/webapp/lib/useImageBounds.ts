"use client";

import { useState, useEffect, RefObject } from "react";

export interface ImageBounds {
  offsetX: number;
  offsetY: number;
  renderedW: number;
  renderedH: number;
}

/**
 * Tracks the actual pixel area occupied by an <img objectFit="contain"> inside
 * its container. Re-computes on image load and container resize.
 *
 * Use the returned bounds to convert between normalised pin coords (0-1) and
 * pixel positions so that pins always align with the visible image, regardless
 * of container dimensions or screen size.
 */
export function useImageBounds(
  containerRef: RefObject<HTMLDivElement | null>,
  imgRef: RefObject<HTMLImageElement | null>,
): ImageBounds | null {
  const [bounds, setBounds] = useState<ImageBounds | null>(null);

  useEffect(() => {
    function compute() {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

      const cW = container.clientWidth;
      const cH = container.clientHeight;
      const aspect = img.naturalWidth / img.naturalHeight;

      let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
      if (cW / cH > aspect) {
        // Container wider than image — letterbox left & right
        renderedH = cH;
        renderedW = cH * aspect;
        offsetX   = (cW - renderedW) / 2;
        offsetY   = 0;
      } else {
        // Container taller than image — letterbox top & bottom
        renderedW = cW;
        renderedH = cW / aspect;
        offsetX   = 0;
        offsetY   = (cH - renderedH) / 2;
      }
      setBounds({ offsetX, offsetY, renderedW, renderedH });
    }

    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    img.addEventListener("load", compute);
    if (img.complete && img.naturalWidth) compute();

    const ro = new ResizeObserver(compute);
    ro.observe(container);

    return () => {
      img.removeEventListener("load", compute);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return bounds;
}

/** Convert a normalised coord (0-1) to a CSS pixel left/top value. */
export function toPixel(norm: number, offset: number, rendered: number): string {
  return `${offset + norm * rendered}px`;
}

/** Convert a raw container-relative click position to a normalised coord (0-1). */
export function toNorm(raw: number, offset: number, rendered: number): number {
  return Math.min(1, Math.max(0, (raw - offset) / rendered));
}
