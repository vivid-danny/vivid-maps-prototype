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
 * Work is chunked via requestIdleCallback (10 sections per chunk) so the main thread
 * isn't blocked on the ~18K setFeatureState calls at load time.
 */
export function useFeatureState({
  mapRef,
  ready,
  model,
}: {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  model: SeatMapModel;
}) {
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const sections = model.sections;
    let i = 0;
    const BATCH = 10; // ~150–250 setFeatureState calls per chunk

    function processBatch() {
      if (!mapRef.current) return;
      const end = Math.min(i + BATCH, sections.length);
      for (; i < end; i++) {
        const section = sections[i];
        const sectionId = section.sectionId;
        const sectionData = model.sectionDataById.get(sectionId);
        const sectionHasAvailable = sectionData
          ? sectionData.rows.some(row => row.seats.some(s => s.status === 'available'))
          : false;

        map.setFeatureState(
          { source: SOURCE_SECTIONS, id: sectionId },
          { unavailable: !sectionHasAvailable },
        );

        if (!sectionData) continue;

        sectionData.rows.forEach((row) => {
          const rowGeoId = `${sectionId}:${row.rowId}`;
          const rowHasAvailable = row.seats.some(s => s.status === 'available');

          map.setFeatureState(
            { source: SOURCE_ROWS, id: rowGeoId },
            { unavailable: !rowHasAvailable },
          );

          row.seats.forEach((seat) => {
            map.setFeatureState(
              { source: SOURCE_SEATS, id: seat.seatId },
              { unavailable: seat.status === 'unavailable' },
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
  }, [ready, model]); // eslint-disable-line react-hooks/exhaustive-deps
}
