import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import {
  LAYER_ROW,
  LAYER_SEAT,
  LAYER_SECTION,
  SOURCE_ROWS,
  SOURCE_SEATS,
  SOURCE_SECTIONS,
} from './constants';
import type { SelectionState, HoverState } from '../model/types';
import { EMPTY_HOVER } from '../model/types';
import {
  buildSectionSelection,
  buildRowSelection,
  buildSectionHover,
  buildRowHover,
} from '../behavior/rules';

interface UseMapInteractionsOptions {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  onSelect: (selection: SelectionState) => void;
  onHover: (hover: HoverState) => void;
  isMobile: boolean;
}

/**
 * Registers click and hover handlers on MapLibre layers.
 *
 * Click: section-fill, row-fill, seat → builds SelectionState from feature properties.
 * Hover: mousemove/mouseleave on same layers → builds HoverState, sets cursor.
 */
export function useMapInteractions({
  mapRef,
  ready,
  onSelect,
  onHover,
  isMobile,
}: UseMapInteractionsOptions) {
  // Store callbacks in refs to avoid re-registering event handlers when they change
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    // Track the last hovered feature IDs to clear them on mouseleave/move
    let hoveredSeatId: string | null = null;
    let hoveredSectionId: string | null = null;
    let hoveredRowGeoId: string | null = null;

    // Tracks last hover emitted to avoid redundant React state updates on mousemove
    let lastSectionId: string | null = null;
    let lastRowId: string | null = null;

    function clearHoverFeatureStates() {
      if (hoveredSectionId) {
        map.setFeatureState({ source: SOURCE_SECTIONS, id: hoveredSectionId }, { hovered: false });
        hoveredSectionId = null;
      }
      if (hoveredRowGeoId) {
        map.setFeatureState({ source: SOURCE_ROWS, id: hoveredRowGeoId }, { hovered: false });
        hoveredRowGeoId = null;
      }
    }

    // --- Click handlers ---

    function handleSectionClick(e: MapLayerMouseEvent) {
      if (!e.features?.[0]) return;
      const props = e.features[0].properties;
      const state = e.features[0].state;
      if (state?.unavailable) return;

      const sectionId = props?.sectionId as string;
      if (!sectionId) return;

      onSelectRef.current(buildSectionSelection(sectionId));
    }

    function handleRowClick(e: MapLayerMouseEvent) {
      if (!e.features?.[0]) return;
      const props = e.features[0].properties;
      const state = e.features[0].state;

      const sectionId = props?.sectionId as string;
      if (!sectionId) return;

      // Unavailable row → select the parent section instead (if section has inventory)
      if (state?.unavailable) {
        const sectionState = map.getFeatureState({ source: SOURCE_SECTIONS, id: sectionId });
        if (!sectionState?.unavailable) {
          onSelectRef.current(buildSectionSelection(sectionId));
        }
        return;
      }

      const rowId = props?.rowId as string;
      if (!rowId) return;

      onSelectRef.current(buildRowSelection(sectionId, rowId));
    }

    function handleSeatClick(e: MapLayerMouseEvent) {
      if (!e.features?.[0]) return;
      const props = e.features[0].properties;
      const state = e.features[0].state;
      if (state?.unavailable) return;

      const sectionId = props?.sectionId as string;
      const rowId = props?.rowId as string;
      const seatId = props?.id as string;
      if (!sectionId || !seatId) return;

      // Build a selection with the seat. The listing lookup happens in the
      // existing handleSelect → viewState pipeline.
      onSelectRef.current({
        sectionId,
        rowId: rowId ?? null,
        listingId: null, // Resolved downstream by matching seatIds to listings
        seatIds: [seatId],
      });
    }

    // --- Hover handlers (desktop only) ---

    function handleSectionHover(e: MapLayerMouseEvent) {
      if (isMobileRef.current) return;
      if (!e.features?.[0]) return;
      const state = e.features[0].state;
      if (state?.unavailable) return;

      const sectionId = e.features[0].properties?.sectionId as string;
      if (!sectionId) return;

      // Skip if already hovering this section in sections mode
      if (lastSectionId === sectionId && lastRowId === null) return;

      clearHoverFeatureStates();
      hoveredSectionId = sectionId;
      map.setFeatureState({ source: SOURCE_SECTIONS, id: sectionId }, { hovered: true });
      map.getCanvas().style.cursor = 'pointer';
      lastSectionId = sectionId;
      lastRowId = null;
      onHoverRef.current(buildSectionHover(sectionId));
    }

    function handleRowHover(e: MapLayerMouseEvent) {
      if (isMobileRef.current) return;
      if (!e.features?.[0]) return;
      const state = e.features[0].state;
      if (state?.unavailable) return;

      const sectionId = e.features[0].properties?.sectionId as string;
      const rowId = e.features[0].properties?.rowId as string;
      if (!sectionId || !rowId) return;

      // Skip if already hovering this row
      if (lastSectionId === sectionId && lastRowId === rowId) return;

      const rowGeoId = `${sectionId}:${rowId}`;
      clearHoverFeatureStates();
      hoveredSectionId = sectionId;
      hoveredRowGeoId = rowGeoId;
      map.setFeatureState({ source: SOURCE_SECTIONS, id: sectionId }, { hovered: true });
      map.setFeatureState({ source: SOURCE_ROWS, id: rowGeoId }, { hovered: true });
      map.getCanvas().style.cursor = 'pointer';
      lastSectionId = sectionId;
      lastRowId = rowId;
      onHoverRef.current(buildRowHover(sectionId, rowId));
    }

    function handleSeatHover(e: MapLayerMouseEvent) {
      if (isMobileRef.current) return;
      if (!e.features?.[0]) return;
      const feature = e.features[0];
      if (feature.state?.unavailable) return;

      const seatId = feature.properties?.id as string;
      if (!seatId) return;

      // Clear previous hovered seat
      if (hoveredSeatId && hoveredSeatId !== seatId) {
        map.setFeatureState({ source: SOURCE_SEATS, id: hoveredSeatId }, { hovered: false });
      }

      hoveredSeatId = seatId;
      map.setFeatureState({ source: SOURCE_SEATS, id: seatId }, { hovered: true });
      map.getCanvas().style.cursor = 'pointer';

      // Emit row-level hover to React so pins can react
      const sectionId = feature.properties?.sectionId as string;
      const rowId = feature.properties?.rowId as string;
      if (sectionId && rowId && (lastSectionId !== sectionId || lastRowId !== rowId)) {
        lastSectionId = sectionId;
        lastRowId = rowId;
        onHoverRef.current(buildRowHover(sectionId, rowId));
      }
    }

    function handleMouseLeave() {
      if (isMobileRef.current) return;
      if (hoveredSeatId) {
        map.setFeatureState({ source: SOURCE_SEATS, id: hoveredSeatId }, { hovered: false });
        hoveredSeatId = null;
      }
      clearHoverFeatureStates();
      lastSectionId = null;
      lastRowId = null;
      map.getCanvas().style.cursor = '';
      onHoverRef.current(EMPTY_HOVER);
    }

    // Register handlers
    map.on('click', LAYER_SECTION, handleSectionClick);
    map.on('click', LAYER_ROW, handleRowClick);
    map.on('click', LAYER_SEAT, handleSeatClick);

    map.on('mousemove', LAYER_SECTION, handleSectionHover);
    map.on('mousemove', LAYER_ROW, handleRowHover);
    map.on('mousemove', LAYER_SEAT, handleSeatHover);

    map.on('mouseleave', LAYER_SECTION, handleMouseLeave);
    map.on('mouseleave', LAYER_ROW, handleMouseLeave);
    map.on('mouseleave', LAYER_SEAT, handleMouseLeave);

    return () => {
      map.off('click', LAYER_SECTION, handleSectionClick);
      map.off('click', LAYER_ROW, handleRowClick);
      map.off('click', LAYER_SEAT, handleSeatClick);

      map.off('mousemove', LAYER_SECTION, handleSectionHover);
      map.off('mousemove', LAYER_ROW, handleRowHover);
      map.off('mousemove', LAYER_SEAT, handleSeatHover);

      map.off('mouseleave', LAYER_SECTION, handleMouseLeave);
      map.off('mouseleave', LAYER_ROW, handleMouseLeave);
      map.off('mouseleave', LAYER_SEAT, handleMouseLeave);
    };
  }, [ready, mapRef]);
}
