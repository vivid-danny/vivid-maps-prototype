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
 * Model row IDs are sectionId-rowNum (e.g. "101-3") — same rowNum, different separator.
 * We reconstruct GeoJSON IDs using array index.
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

    for (const section of model.sections) {
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

      sectionData.rows.forEach((row, rowIndex) => {
        const rowNum = rowIndex + 1;
        const rowGeoId = `${sectionId}:${rowNum}`;
        const rowHasAvailable = row.seats.some(s => s.status === 'available');

        map.setFeatureState(
          { source: SOURCE_ROWS, id: rowGeoId },
          { unavailable: !rowHasAvailable },
        );

        row.seats.forEach((seat, seatIndex) => {
          const seatGeoId = `${sectionId}:${rowNum}:s${seatIndex + 1}`;
          map.setFeatureState(
            { source: SOURCE_SEATS, id: seatGeoId },
            { unavailable: seat.status === 'unavailable' },
          );
        });
      });
    }
  }, [ready, model]); // eslint-disable-line react-hooks/exhaustive-deps
}
