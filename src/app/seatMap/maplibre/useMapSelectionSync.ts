import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { SOURCE_ROWS, SOURCE_SEATS, SOURCE_SEAT_CONNECTORS, SOURCE_SECTIONS } from './constants';
import type { SelectionState, HoverState, SectionData, DisplayMode } from '../model/types';

interface UseMapSelectionSyncOptions {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  selection: SelectionState;
  hoverState: HoverState;
  sectionDataById: Map<string, SectionData>;
  displayMode: DisplayMode;
}

/**
 * Syncs React selection/hover state → MapLibre feature state.
 *
 * Section selection is handled by overlay layers (section-selected-overlay,
 * section-selected-outline) in MapLibreVenue.tsx, matching the production pattern.
 * Row/seat selection still uses feature-state (drives row-selected-overlay paint).
 * Hover uses feature-state for all layers.
 *
 * Cross-level muting via `parentMuted` feature-state:
 * - Section-only selection: mutes all rows outside the selected section.
 * - Row selection: mutes all rows except the selected row.
 * - Hover-reveal: hovering a muted section temporarily unmutes its rows
 *   so the darken overlay shows against the original color.
 */
export function useMapSelectionSync({
  mapRef,
  ready,
  selection,
  hoverState,
  sectionDataById,
  displayMode,
}: UseMapSelectionSyncOptions) {
  const prevSelectionRef = useRef<SelectionState | null>(null);
  const prevHoverRef = useRef<HoverState | null>(null);
  const parentMutedRowsRef = useRef<Set<string>>(new Set());
  const hoverRevealedRowsRef = useRef<Set<string>>(new Set());

  // --- Selection sync (rows + seats only; sections use overlay layers) ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevSelectionRef.current;

    // Clear previous row/seat/connector selection
    if (prev?.rowId && prev?.sectionId) {
      const rowGeoId = `${prev.sectionId}:${prev.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { selected: false });
    }
    if (prev?.seatIds) {
      for (const seatId of prev.seatIds) {
        safeSetState(map, SOURCE_SEATS, seatId, { selected: false });
      }
    }
    if (prev?.listingId) {
      safeSetState(map, SOURCE_SEAT_CONNECTORS, prev.listingId, { selected: false });
    }

    // Set new row/seat/connector selection
    if (selection.rowId && selection.sectionId) {
      const rowGeoId = `${selection.sectionId}:${selection.rowId}`;
      safeSetState(map, SOURCE_ROWS, rowGeoId, { selected: true });
    }
    if (selection.seatIds) {
      for (const seatId of selection.seatIds) {
        safeSetState(map, SOURCE_SEATS, seatId, { selected: true });
      }
    }
    if (selection.listingId) {
      safeSetState(map, SOURCE_SEAT_CONNECTORS, selection.listingId, { selected: true });
    }

    prevSelectionRef.current = selection;
  }, [ready, selection]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cross-level parentMuted sync ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    // Clear all previous parentMuted states
    for (const rowId of parentMutedRowsRef.current) {
      safeSetState(map, SOURCE_ROWS, rowId, { parentMuted: false });
    }
    parentMutedRowsRef.current.clear();
    hoverRevealedRowsRef.current.clear();

    const isChildMode = displayMode === 'rows' || displayMode === 'seats';
    const hasSection = !!selection.sectionId;
    const hasRow = !!selection.rowId;

    if (hasSection && isChildMode) {
      const selectedRowGeoId = hasRow ? `${selection.sectionId}:${selection.rowId}` : null;

      for (const [sectionId, sectionData] of sectionDataById) {
        for (const row of sectionData.rows) {
          const rowGeoId = `${sectionId}:${row.rowId}`;

          // Mute if: different section, OR same section but different row (when row is selected)
          const shouldMute = sectionId !== selection.sectionId
            || (selectedRowGeoId !== null && rowGeoId !== selectedRowGeoId);

          if (shouldMute) {
            safeSetState(map, SOURCE_ROWS, rowGeoId, { parentMuted: true });
            parentMutedRowsRef.current.add(rowGeoId);
          }
        }
      }
    }
  }, [ready, selection.sectionId, selection.rowId, displayMode, sectionDataById]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Hover sync ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevHoverRef.current;

    // Restore previously hover-revealed rows
    for (const rowId of hoverRevealedRowsRef.current) {
      if (parentMutedRowsRef.current.has(rowId)) {
        safeSetState(map, SOURCE_ROWS, rowId, { parentMuted: true });
      }
    }
    hoverRevealedRowsRef.current.clear();

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

    // Hover-reveal: if hovering a non-selected section that has muted rows,
    // temporarily clear parentMuted so the darken overlay composites against the
    // original zone color. Only needed for cross-section hover (section polygon hover);
    // same-section row hover is handled by the paint expression where hovered > parentMuted.
    if (hoverState.sectionId && hoverState.sectionId !== selection.sectionId && parentMutedRowsRef.current.size > 0) {
      const sectionData = sectionDataById.get(hoverState.sectionId);
      if (sectionData) {
        for (const row of sectionData.rows) {
          const rowGeoId = `${hoverState.sectionId}:${row.rowId}`;
          if (parentMutedRowsRef.current.has(rowGeoId)) {
            safeSetState(map, SOURCE_ROWS, rowGeoId, { parentMuted: false });
            hoverRevealedRowsRef.current.add(rowGeoId);
          }
        }
      }
    }

    prevHoverRef.current = hoverState;
  }, [ready, hoverState, selection.sectionId, sectionDataById]); // eslint-disable-line react-hooks/exhaustive-deps
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
