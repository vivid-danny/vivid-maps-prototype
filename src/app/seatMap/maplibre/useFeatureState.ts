import { useEffect } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { SOURCE_ROWS, SOURCE_SEATS, SOURCE_SECTIONS } from './constants';
import type { SeatMapModel } from '../model/types';

/**
 * Sets available/unavailable feature state on all section, row, and seat features
 * based on the model's inventory data.
 *
 * GeoJSON IDs:
 *   section: sectionId               (e.g. "101")
 *   row:     sectionId:rowNum        (e.g. "101:3")  — rowNum is 1-indexed in GeoJSON
 *   seat:    sectionId:rowNum:sN     (e.g. "101:3:s5")
 *
 * Model row IDs are the raw rowId string (e.g. "3"), combined with sectionId to build
 * the GeoJSON feature ID (e.g. "101:3"). Seat IDs in the model match GeoJSON ids directly.
 *
 * Sections are processed immediately (source always has data). Rows and seats are
 * deferred until detailSourcesLoaded flips to true (when the GeoJSON is loaded on demand).
 * Row/seat work is chunked via requestIdleCallback so the main thread isn't blocked.
 */
export function useFeatureState({
  mapRef,
  ready,
  model,
  seatableIds,
  detailSourcesLoaded,
}: {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  model: SeatMapModel;
  seatableIds: string[];
  detailSourcesLoaded: boolean;
}) {
  // --- Section feature states (sections source is always loaded) ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    for (const section of model.sections) {
      const sectionListings = model.listingsBySection.get(section.sectionId);
      const sectionHasAvailable = !!sectionListings && sectionListings.length > 0;
      map.setFeatureState(
        { source: SOURCE_SECTIONS, id: section.sectionId },
        { unavailable: !sectionHasAvailable },
      );
    }
  }, [ready, model]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark seatable sections that have no model data as unavailable.
  useEffect(() => {
    if (!ready || !mapRef.current || seatableIds.length === 0) return;
    const map = mapRef.current;
    for (const id of seatableIds) {
      if (!model.sectionDataById.has(id)) {
        map.setFeatureState({ source: SOURCE_SECTIONS, id }, { unavailable: true });
      }
    }
  }, [ready, seatableIds, model]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Row + seat feature states (deferred until sources are loaded) ---
  useEffect(() => {
    if (!ready || !mapRef.current || !detailSourcesLoaded) return;
    const map = mapRef.current;
    const sections = model.sections;

    // Build listing-based availability lookups
    const seatIdsWithListings = new Set<string>();
    const rowGeoIdsWithListings = new Set<string>();
    for (const listing of model.listings) {
      rowGeoIdsWithListings.add(`${listing.sectionId}:${listing.rowId}`);
      for (const seatId of listing.seatIds) {
        seatIdsWithListings.add(seatId);
      }
    }

    let i = 0;
    const BATCH = 10; // ~150–250 setFeatureState calls per chunk

    function processBatch() {
      if (!mapRef.current) return;
      const end = Math.min(i + BATCH, sections.length);
      for (; i < end; i++) {
        const section = sections[i];
        const sectionId = section.sectionId;
        const sectionData = model.sectionDataById.get(sectionId);
        if (!sectionData) continue;

        sectionData.rows.forEach((row) => {
          const rowGeoId = `${sectionId}:${row.rowId}`;

          map.setFeatureState(
            { source: SOURCE_ROWS, id: rowGeoId },
            { unavailable: !rowGeoIdsWithListings.has(rowGeoId) },
          );

          row.seats.forEach((seat) => {
            map.setFeatureState(
              { source: SOURCE_SEATS, id: seat.seatId },
              { unavailable: !seatIdsWithListings.has(seat.seatId) },
            );
          });
        });
      }

      if (i < sections.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processBatch, { timeout: 500 });
        } else {
          setTimeout(processBatch, 0);
        }
      }
    }

    processBatch();
  }, [ready, model, detailSourcesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
}
