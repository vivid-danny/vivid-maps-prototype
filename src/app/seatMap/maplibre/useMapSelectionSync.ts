import { useCallback, useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import {
  SOURCE_ROWS, SOURCE_SEATS, SOURCE_SEAT_CONNECTORS, SOURCE_SECTIONS,
  SEAT_MUTED_LAYERS, LAYER_ROW_SELECTED_OVERLAY,
} from './constants';
import type { SelectionState, HoverState, DisplayMode } from '../model/types';
import type { LevelOverlays } from '../config/types';
import { buildRowFeatureId } from '../model/ids';

interface UseMapSelectionSyncOptions {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  selection: SelectionState;
  hoverState: HoverState;
  displayMode: DisplayMode;
  overlays: { row: LevelOverlays };
}

/**
 * Syncs React selection/hover state → MapLibre feature state + paint expressions.
 *
 * Cross-level muting is paint-expression-driven: the row-selected-overlay fill-color
 * expression checks sectionId/rowId properties directly, so updating muting is a
 * single setPaintProperty call instead of thousands of setFeatureState calls.
 *
 * Hover visual updates are exposed via `syncHoverFromMap` so useMapInteractions can
 * call them synchronously from event handlers (same frame as the mouse event).
 */
export function useMapSelectionSync({
  mapRef,
  ready,
  selection,
  hoverState,
  displayMode,
  overlays,
}: UseMapSelectionSyncOptions) {
  const prevSelectionRef = useRef<SelectionState | null>(null);

  // Refs for syncHover to read current values without stale closures
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  // Track previous hover for clearing feature states
  const prevHoverSectionId = useRef<string | null>(null);
  const prevHoverRowGeoId = useRef<string | null>(null);

  // --- Selection sync (rows + seats + connectors) ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const prev = prevSelectionRef.current;

    // Clear previous row/seat/connector selection
    if (prev?.rowId && prev?.sectionId) {
      const rowGeoId = buildRowFeatureId(prev.sectionId, prev.rowId);
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
      const rowGeoId = buildRowFeatureId(selection.sectionId, selection.rowId);
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

  // --- Row overlay expression (replaces per-row parentMuted feature state) ---

  function buildRowOverlayExpression(
    sel: SelectionState,
    dm: DisplayMode,
    rowOverlays: LevelOverlays,
    hoveredSectionId: string | null,
  ): any[] {
    const rowSelected = (dm === 'seats' && rowOverlays.selectedInSeats)
      ? rowOverlays.selectedInSeats
      : rowOverlays.selected;
    const transparent = 'rgba(4,9,44,0)';
    const isChildMode = dm === 'rows' || dm === 'seats';

    const expr: any[] = ['case'];
    expr.push(['boolean', ['feature-state', 'selected'], false], rowSelected);
    expr.push(['boolean', ['feature-state', 'hovered'], false], transparent);

    if (sel.sectionId && isChildMode) {
      const hoverReveal = hoveredSectionId && hoveredSectionId !== sel.sectionId;

      // Core muted condition (without hover-reveal guard).
      // Row selected: mute rows outside the section, or inside the section but not the selected
      // row and still available (rows without inventory are left unobscured).
      // Section selected: mute all rows outside the selected section.
      const coreMuted = sel.rowId
        ? ['any',
            ['!=', ['get', 'sectionId'], sel.sectionId],
            ['all',
              ['!=', ['get', 'rowId'], sel.rowId],
              ['!', ['boolean', ['get', 'unavailable'], false]],
            ],
          ]
        : ['!=', ['get', 'sectionId'], sel.sectionId];

      // Hover-reveal: exempt the hovered section from muting by wrapping with a guard.
      const mutedCondition = hoverReveal
        ? ['all', ['!=', ['get', 'sectionId'], hoveredSectionId], coreMuted]
        : coreMuted;

      expr.push(mutedCondition, rowOverlays.muted);
    }

    expr.push(transparent);
    return expr;
  }

  // Track whether hover-reveal is active to avoid redundant setPaintProperty calls.
  // When hovering the selected section or no section, the expression is the same (no reveal clause).
  const hoverRevealActiveRef = useRef(false);

  function applyRowOverlay(map: MaplibreMap, hoveredSectionId: string | null, force = false) {
    const sel = selectionRef.current;
    const needsReveal = !!hoveredSectionId && hoveredSectionId !== sel.sectionId;

    // Skip the expensive setPaintProperty call if hover-reveal state hasn't changed.
    // force=true bypasses this cache (used when selection changes to always rebuild).
    if (!force && !needsReveal && !hoverRevealActiveRef.current) return;

    hoverRevealActiveRef.current = needsReveal;
    const expr = buildRowOverlayExpression(
      sel, displayModeRef.current, overlaysRef.current.row, hoveredSectionId,
    );
    map.setPaintProperty(LAYER_ROW_SELECTED_OVERLAY, 'fill-color', expr);
  }

  // Rebuild when selection/displayMode/overlays change — always apply (bypass hover-reveal cache)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    hoverRevealActiveRef.current = false; // reset so applyRowOverlay recalculates from scratch
    applyRowOverlay(mapRef.current, prevHoverSectionId.current, true);
  }, [ready, selection.sectionId, selection.rowId, displayMode, overlays]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Synchronous hover visual update ---

  const syncHover = useCallback((nextHover: HoverState) => {
    const map = mapRef.current;
    if (!map) return;

    const sel = selectionRef.current;
    const dm = displayModeRef.current;

    // Clear previous hover feature states
    if (prevHoverSectionId.current) {
      safeSetState(map, SOURCE_SECTIONS, prevHoverSectionId.current, { hovered: false });
    }
    if (prevHoverRowGeoId.current) {
      safeSetState(map, SOURCE_ROWS, prevHoverRowGeoId.current, { hovered: false });
    }

    // Set new hover feature states
    if (nextHover.sectionId) {
      safeSetState(map, SOURCE_SECTIONS, nextHover.sectionId, { hovered: true });
    }
    const nextRowGeoId = (nextHover.sectionId && nextHover.rowId)
      ? buildRowFeatureId(nextHover.sectionId, nextHover.rowId) : null;
    if (nextRowGeoId) {
      safeSetState(map, SOURCE_ROWS, nextRowGeoId, { hovered: true });
    }

    // Rebuild row overlay expression if hovered section changed (hover-reveal)
    if (prevHoverSectionId.current !== nextHover.sectionId) {
      applyRowOverlay(map, nextHover.sectionId);
    }

    prevHoverSectionId.current = nextHover.sectionId;
    prevHoverRowGeoId.current = nextRowGeoId;

    // Seat/connector muted overlay filter (hover-reveal for seats mode).
    // Only update when hover-reveal state actually changes to avoid redundant setFilter calls.
    if (dm === 'seats' && sel.sectionId) {
      const wasRevealingSeats = prevHoverSectionId.current
        && prevHoverSectionId.current !== sel.sectionId
        && prevHoverRowGeoId.current;
      const isHoveringMutedRow = nextHover.sectionId
        && nextHover.sectionId !== sel.sectionId
        && nextHover.rowId;

      // Only update filter if the hover-reveal row changed
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
      } else if (wasRevealingSeats) {
        // Transitioning from hover-reveal to no reveal — reset to simple filter
        const mutedFilter: any = ['!=', ['get', 'sectionId'], sel.sectionId];
        for (const layer of SEAT_MUTED_LAYERS) map.setFilter(layer, mutedFilter);
      }
      // else: no hover-reveal before or now — skip setFilter entirely
    }
  }, [mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: sync hover from React state changes (panel hover, deselection clear)
  const lastSyncedHoverRef = useRef<HoverState | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (lastSyncedHoverRef.current === hoverState) return;
    syncHover(hoverState);
    lastSyncedHoverRef.current = hoverState;
  }, [ready, hoverState, syncHover]);

  const syncHoverFromMap = useCallback((hover: HoverState) => {
    lastSyncedHoverRef.current = hover;
    syncHover(hover);
  }, [syncHover]);

  return { syncHoverFromMap };
}

function safeSetState(
  map: MaplibreMap,
  source: string,
  id: string,
  state: Record<string, boolean>,
) {
  try {
    map.setFeatureState({ source, id }, state);
  } catch {
    // Feature may not exist in source
  }
}
