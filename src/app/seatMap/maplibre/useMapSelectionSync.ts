import { useCallback, useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { SOURCE_ROWS, SOURCE_SEATS, SOURCE_SEAT_CONNECTORS, SOURCE_SECTIONS, SEAT_MUTED_LAYERS } from './constants';
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
 *
 * Cross-level muting via `parentMuted` feature-state:
 * - Section-only selection: mutes all rows outside the selected section.
 * - Row selection: mutes all rows except the selected row.
 * - Hover-reveal: hovering a muted section temporarily unmutes its rows
 *   so the darken overlay shows against the original color.
 *
 * Hover visual updates are exposed via `syncHoverRef` so useMapInteractions can
 * call them synchronously from event handlers (same frame as the mouse event),
 * avoiding the lag of a React state → effect cycle.
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
  const parentMutedRowsRef = useRef<Set<string>>(new Set());
  const hoverRevealedRowsRef = useRef<Set<string>>(new Set());

  // Keep refs to current values so syncHover can read them without stale closures
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const sectionDataByIdRef = useRef(sectionDataById);
  sectionDataByIdRef.current = sectionDataById;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;

  // Track previous hover for clearing feature states
  const prevHoverSectionId = useRef<string | null>(null);
  const prevHoverRowGeoId = useRef<string | null>(null);

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

  /**
   * Synchronous hover visual update — called directly from useMapInteractions
   * event handlers so all hover visuals (section/row feature state, row parentMuted
   * reveal, seat/connector muted filter) update in the same frame as the mouse event.
   */
  const syncHover = useCallback((nextHover: HoverState) => {
    const map = mapRef.current;
    if (!map) return;

    const sel = selectionRef.current;
    const sectionData = sectionDataByIdRef.current;
    const dm = displayModeRef.current;

    // --- Clear previous hover feature states ---
    if (prevHoverSectionId.current) {
      safeSetState(map, SOURCE_SECTIONS, prevHoverSectionId.current, { hovered: false });
    }
    if (prevHoverRowGeoId.current) {
      safeSetState(map, SOURCE_ROWS, prevHoverRowGeoId.current, { hovered: false });
    }

    // --- Set new hover feature states ---
    if (nextHover.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, nextHover.sectionId, { hovered: true });
    }
    const nextRowGeoId = (nextHover.sectionId && nextHover.rowId)
      ? `${nextHover.sectionId}:${nextHover.rowId}` : null;
    if (nextRowGeoId) {
      safeSetState(map, SOURCE_ROWS, nextRowGeoId, { hovered: true });
    }

    prevHoverSectionId.current = nextHover.sectionId;
    prevHoverRowGeoId.current = nextRowGeoId;

    // --- Diff-based row parentMuted hover-reveal ---
    const nextRevealed = new Set<string>();
    if (nextHover.sectionId && nextHover.sectionId !== sel.sectionId && parentMutedRowsRef.current.size > 0) {
      const sd = sectionData.get(nextHover.sectionId);
      if (sd) {
        for (const row of sd.rows) {
          const rowGeoId = `${nextHover.sectionId}:${row.rowId}`;
          if (parentMutedRowsRef.current.has(rowGeoId)) {
            nextRevealed.add(rowGeoId);
          }
        }
      }
    }

    // Restore rows leaving the revealed set
    for (const rowId of hoverRevealedRowsRef.current) {
      if (!nextRevealed.has(rowId) && parentMutedRowsRef.current.has(rowId)) {
        safeSetState(map, SOURCE_ROWS, rowId, { parentMuted: true });
      }
    }
    // Unmute rows entering the revealed set
    for (const rowId of nextRevealed) {
      if (!hoverRevealedRowsRef.current.has(rowId)) {
        safeSetState(map, SOURCE_ROWS, rowId, { parentMuted: false });
      }
    }
    hoverRevealedRowsRef.current = nextRevealed;

    // --- Seat/connector muted overlay filter (hover-reveal for seats display mode) ---
    if (dm === 'seats' && sel.sectionId) {
      const isHoveringMutedRow = nextHover.sectionId
        && nextHover.sectionId !== sel.sectionId
        && nextHover.rowId;

      if (isHoveringMutedRow) {
        const mutedFilter: any = [
          'all',
          ['!=', ['get', 'sectionId'], sel.sectionId],
          ['!', ['all',
            ['==', ['get', 'sectionId'], nextHover.sectionId],
            ['==', ['get', 'rowId'], nextHover.rowId],
          ]],
        ];
        for (const layer of SEAT_MUTED_LAYERS) map.setFilter(layer, mutedFilter);
      } else {
        const mutedFilter: any = ['!=', ['get', 'sectionId'], sel.sectionId];
        for (const layer of SEAT_MUTED_LAYERS) map.setFilter(layer, mutedFilter);
      }
    }
  }, [mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync hover when hoverState changes from React (e.g. panel hover, deselection clear).
  // Map-driven hovers call syncHover directly and skip this path.
  const lastSyncedHoverRef = useRef<HoverState | null>(null);
  useEffect(() => {
    if (!ready) return;
    // Skip if this hover was already applied synchronously by useMapInteractions
    if (lastSyncedHoverRef.current === hoverState) return;
    syncHover(hoverState);
    lastSyncedHoverRef.current = hoverState;
  }, [ready, hoverState, syncHover]);

  /**
   * Wrapper that marks the hover as already synced (to prevent the effect from
   * double-applying it) and runs the synchronous visual update.
   */
  const syncHoverFromMap = useCallback((hover: HoverState) => {
    lastSyncedHoverRef.current = hover;
    syncHover(hover);
  }, [syncHover]);

  return { syncHoverFromMap };
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
