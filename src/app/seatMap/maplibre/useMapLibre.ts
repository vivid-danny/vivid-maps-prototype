import { useEffect, useRef, useState } from 'react';
import { Map as MaplibreMap } from 'maplibre-gl';
import type { StyleSpecification, LngLatBoundsLike } from 'maplibre-gl';

interface UseMapLibreOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  style: StyleSpecification;
  bounds: LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
}

export function useMapLibre({ containerRef, style, bounds, minZoom = 3, maxZoom = 22 }: UseMapLibreOptions) {
  const mapRef = useRef<MaplibreMap | null>(null);
  const [zoom, setZoom] = useState<number>(5);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style,
      bounds,
      fitBoundsOptions: { padding: 40 },
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
      setZoom(map.getZoom());
      setReady(true);
    });

    map.on('zoom', () => {
      setZoom(map.getZoom());
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return { mapRef, zoom, ready };
}
