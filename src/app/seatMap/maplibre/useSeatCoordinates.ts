import { useState, useEffect } from 'react';

/**
 * Fetches the seats GeoJSON once when detail sources load and caches a
 * seatId → [lng, lat] coordinate map. Returns null until the data is ready.
 *
 * The browser serves this from HTTP cache since MapLibre already fetches the
 * same URL for the seats source layer — no extra network round-trip.
 */
export function useSeatCoordinates({
  seatsUrl,
  detailSourcesLoaded,
}: {
  seatsUrl: string;
  detailSourcesLoaded: boolean;
}): Map<string, [number, number]> | null {
  const [coordMap, setCoordMap] = useState<Map<string, [number, number]> | null>(null);

  useEffect(() => {
    if (!detailSourcesLoaded) return;
    let cancelled = false;

    fetch(seatsUrl)
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (cancelled) return;

        const map = new Map<string, [number, number]>();
        for (const f of geojson.features) {
          const seatId = f.properties?.id as string;
          if (seatId && f.geometry.type === 'Point') {
            map.set(seatId, (f.geometry as GeoJSON.Point).coordinates as [number, number]);
          }
        }
        setCoordMap(map);
      });

    return () => {
      cancelled = true;
    };
  }, [seatsUrl, detailSourcesLoaded]);

  return coordMap;
}
