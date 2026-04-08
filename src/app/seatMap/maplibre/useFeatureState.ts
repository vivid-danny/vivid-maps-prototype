import { useEffect } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { SOURCE_SECTIONS } from './constants';
import type { SeatMapModel } from '../model/types';

/**
 * Keeps section unavailable state on feature-state.
 * Row and seat unavailable rendering is source-property-driven.
 */
export function useFeatureState({
  mapRef,
  ready,
  model,
  seatableIds,
}: {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  model: SeatMapModel;
  seatableIds: string[];
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
}
