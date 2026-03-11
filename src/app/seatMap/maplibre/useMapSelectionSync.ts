import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { SOURCE_ROWS, SOURCE_SEATS, SOURCE_SECTIONS } from './constants';
import type { SelectionState, HoverState } from '../model/types';

interface UseMapSelectionSyncOptions {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  selection: SelectionState;
  hoverState: HoverState;
}

/**
 * Syncs React selection/hover state → MapLibre feature state.
 *
 * When selection or hover changes, clears the previous feature state
 * and sets the new one. Paint expressions in the style read these
 * feature states to drive fill colors.
 */
export function useMapSelectionSync({
  mapRef,
  ready,
  selection,
  hoverState,
}: UseMapSelectionSyncOptions) {
  const prevSelectionRef = useRef<SelectionState | null>(null);
  const prevHoverRef = useRef<HoverState | null>(null);

  // --- Selection sync ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevSelectionRef.current;

    // Clear previous selection
    if (prev?.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, prev.sectionId, { selected: false });
    }
    if (prev?.rowId && prev?.sectionId) {
      // Row GeoJSON IDs use rowId from model (e.g. "101:1")
      const rowGeoId = `${prev.sectionId}:${prev.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { selected: false });
    }
    if (prev?.seatIds) {
      for (const seatId of prev.seatIds) {
        safeSetState(map, SOURCE_SEATS, seatId, { selected: false });
      }
    }

    // Set new selection
    if (selection.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, selection.sectionId, { selected: true });
    }
    if (selection.rowId && selection.sectionId) {
      const rowGeoId = `${selection.sectionId}:${selection.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { selected: true });
    }
    if (selection.seatIds) {
      for (const seatId of selection.seatIds) {
        safeSetState(map, SOURCE_SEATS, seatId, { selected: true });
      }
    }

    prevSelectionRef.current = selection;
  }, [ready, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Hover sync ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevHoverRef.current;

    // Clear previous hover
    if (prev?.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, prev.sectionId, { hovered: false });
    }
    if (prev?.rowId && prev?.sectionId) {
      const rowGeoId = `${prev.sectionId}:${prev.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { hovered: false });
    }

    // Set new hover
    if (hoverState.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, hoverState.sectionId, { hovered: true });
    }
    if (hoverState.rowId && hoverState.sectionId) {
      const rowGeoId = `${hoverState.sectionId}:${hoverState.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { hovered: true });
    }

    prevHoverRef.current = hoverState;
  }, [ready, hoverState]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Safely call setFeatureState — silently ignores features that don't exist in the source. */
function safeSetState(
  map: MaplibreMap,
  source: string,
  id: string,
  state: Record<string, boolean>,
) {
  try {
    map.setFeatureState({ source, id }, state);
  } catch {
    // Feature may not exist in source (e.g. section ID in model but not in GeoJSON)
  }
}
