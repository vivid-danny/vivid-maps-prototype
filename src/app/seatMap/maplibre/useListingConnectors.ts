import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource, MapSourceDataEvent } from 'maplibre-gl';
import { SOURCE_SEATS, SOURCE_SEAT_CONNECTORS } from './constants';
import type { Listing } from '../model/types';

/**
 * Builds LineString features connecting consecutive seats within each listing
 * and populates the seat-connectors dynamic GeoJSON source.
 *
 * Waits for the seats source to finish loading before querying coordinates.
 */
export function useListingConnectors({
  mapRef,
  ready,
  listings,
}: {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  listings: Listing[];
}) {
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;

    function buildConnectors() {
      if (cancelled || !mapRef.current) return;

      // Query all seat features from the source to get their coordinates
      const seatFeatures = map.querySourceFeatures(SOURCE_SEATS);
      if (seatFeatures.length === 0) return false; // not loaded yet

      // Build seatId → coordinates map (deduplicate across internal tiles)
      const coordsBySeatId = new Map<string, [number, number]>();
      for (const f of seatFeatures) {
        const seatId = f.properties?.id as string;
        if (seatId && f.geometry.type === 'Point' && !coordsBySeatId.has(seatId)) {
          coordsBySeatId.set(seatId, (f.geometry as GeoJSON.Point).coordinates as [number, number]);
        }
      }

      // Build LineString features for listings with 2+ seats
      const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      for (const listing of listings) {
        if (listing.seatIds.length < 2) continue;

        const coords: [number, number][] = [];
        for (const seatId of listing.seatIds) {
          const c = coordsBySeatId.get(seatId);
          if (c) coords.push(c);
        }
        if (coords.length < 2) continue;

        features.push({
          type: 'Feature',
          properties: {
            listingId: listing.listingId,
            sectionId: listing.sectionId,
            rowId: String(listing.rowId),
          },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }

      const source = map.getSource(SOURCE_SEAT_CONNECTORS) as GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
      }
      return true;
    }

    // Try immediately — source may already be loaded
    if (buildConnectors()) return;

    // Otherwise wait for the seats source to finish loading
    function onSourceData(e: MapSourceDataEvent) {
      if (e.sourceId === SOURCE_SEATS && e.isSourceLoaded) {
        if (buildConnectors()) {
          map.off('sourcedata', onSourceData);
        }
      }
    }
    map.on('sourcedata', onSourceData);

    return () => {
      cancelled = true;
      map.off('sourcedata', onSourceData);
    };
  }, [ready, listings]); // eslint-disable-line react-hooks/exhaustive-deps
}
