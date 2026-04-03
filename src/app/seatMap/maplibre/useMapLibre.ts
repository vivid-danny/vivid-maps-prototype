import { useEffect, useRef, useState } from 'react';
import { Map as MaplibreMap } from 'maplibre-gl';
import type { StyleSpecification, LngLatBoundsLike } from 'maplibre-gl';

interface UseMapLibreOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  style: StyleSpecification;
  bounds: LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
  fitBoundsPadding?: number;
  onZoomChange?: (zoom: number) => void;
}

export function useMapLibre({ containerRef, style, bounds, minZoom = 3, maxZoom = 22, fitBoundsPadding = 40, onZoomChange }: UseMapLibreOptions) {
  const mapRef = useRef<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);

  // Stable ref for the callback so map event listeners never go stale
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style,
      bounds,
      fitBoundsOptions: { padding: fitBoundsPadding, bearing: -57 },
      minZoom,
      maxZoom,
      attributionControl: false,
    });

    mapRef.current = map;

    // Expose map on window for console inspection
    // Usage: __map.getStyle().layers, __map.getLayoutProperty('section-fill', 'visibility')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__map = map;

    map.on('load', () => {
      onZoomChangeRef.current?.(map.getZoom());
      setReady(true);
    });

    map.on('zoom', () => {
      onZoomChangeRef.current?.(map.getZoom());
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return { mapRef, ready };
}
