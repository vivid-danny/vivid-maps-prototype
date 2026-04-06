import { useEffect } from 'react';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import { SOURCE_SEAT_CONNECTORS } from './constants';
import type { Listing } from '../model/types';

/**
 * Builds LineString features connecting consecutive seats within each listing
 * and populates the seat-connectors dynamic GeoJSON source.
 *
 * Uses a pre-built coordinate map (from useSeatCoordinates) so connector
 * generation is independent of the viewport — all seats are available
 * regardless of which tiles MapLibre has rendered.
 */
export function useListingConnectors({
  mapRef,
  ready,
  listings,
  coordsBySeatId,
}: {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  listings: Listing[];
  coordsBySeatId: Map<string, [number, number]> | null;
}) {
  useEffect(() => {
    if (!ready || !mapRef.current || !coordsBySeatId) return;
    const map = mapRef.current;

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
  }, [ready, listings, coordsBySeatId]); // eslint-disable-line react-hooks/exhaustive-deps
}
