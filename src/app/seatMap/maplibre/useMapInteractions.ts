import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import {
  LAYER_ROW,
  LAYER_SEAT,
  LAYER_SEAT_INTERACTION,
  LAYER_SEAT_CONNECTOR,
  LAYER_SECTION,
  SOURCE_SEATS,
  SOURCE_SEAT_CONNECTORS,
  SOURCE_SECTIONS,
} from './constants';
import type { SelectionState, HoverState, Listing } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import {
  buildSectionSelection,
  buildRowSelection,
  buildSectionHover,
  buildListingHover,
  buildRowHover,
} from '../behavior/rules';

interface UseMapInteractionsOptions {
  mapRef: React.RefObject<MaplibreMap | null>;
  ready: boolean;
  onSelect: (selection: SelectionState) => void;
  onHover: (hover: HoverState) => void;
  /** Synchronous hover visual update — applies all map visuals in the same frame. */
  syncHoverFromMap: (hover: HoverState) => void;
  isMobile: boolean;
  listingsBySeatId: Map<string, Listing>;
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
  syncHoverFromMap,
  isMobile,
  listingsBySeatId,
}: UseMapInteractionsOptions) {
  const HOVER_EXIT_GRACE_MS = 60;

  // Store callbacks in refs to avoid re-registering event handlers when they change
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const syncHoverFromMapRef = useRef(syncHoverFromMap);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;
  syncHoverFromMapRef.current = syncHoverFromMap;

  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  const listingsBySeatIdRef = useRef(listingsBySeatId);
  listingsBySeatIdRef.current = listingsBySeatId;

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    /** Safely set feature state on a connector line (may not exist if source is empty). */
    function setConnectorState(id: string | null, state: Record<string, boolean>) {
      if (!id) return;
      try { map.setFeatureState({ source: SOURCE_SEAT_CONNECTORS, id }, state); } catch { /* noop */ }
    }

    // Build listingId → Listing lookup for connector hover/click handlers
    const listingsById = new Map<string, Listing>();
    for (const listing of listingsBySeatIdRef.current.values()) {
      if (!listingsById.has(listing.listingId)) {
        listingsById.set(listing.listingId, listing);
      }
    }

    // Track the last hovered feature IDs to clear them on mouseleave/move
    let hoveredSeatIds: string[] = [];
    let hoveredConnectorId: string | null = null;

    // Tracks last hover emitted to avoid redundant React state updates on mousemove
    let lastSectionId: string | null = null;
    let lastRowId: string | null = null;
    let lastListingId: string | null = null;

    // Deferred mouseleave: prevents flicker when moving between seat ↔ connector
    // by deferring the clear to the next frame, allowing an adjacent mousemove to cancel it.
    let pendingLeaveTimeout: number | null = null;

    function cancelPendingLeave() {
      if (pendingLeaveTimeout !== null) {
        window.clearTimeout(pendingLeaveTimeout);
        pendingLeaveTimeout = null;
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

      cancelPendingLeave();
      // Clear stale seat-level hover states (e.g. mouse moved from seat to section)
      if (hoveredSeatIds.length > 0) {
        for (const id of hoveredSeatIds) {
          map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: false });
        }
        setConnectorState(hoveredConnectorId, { hovered: false });
        hoveredSeatIds = [];
        hoveredConnectorId = null;
      }
      map.getCanvas().style.cursor = 'pointer';
      lastSectionId = sectionId;
      lastRowId = null;
      lastListingId = null;
      const hover = buildSectionHover(sectionId);
      syncHoverFromMapRef.current(hover);
      onHoverRef.current(hover);
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

      cancelPendingLeave();
      // Clear stale seat-level hover states (e.g. mouse moved from seat to row)
      if (hoveredSeatIds.length > 0) {
        for (const id of hoveredSeatIds) {
          map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: false });
        }
        setConnectorState(hoveredConnectorId, { hovered: false });
        hoveredSeatIds = [];
        hoveredConnectorId = null;
      }
      map.getCanvas().style.cursor = 'pointer';
      lastSectionId = sectionId;
      lastRowId = rowId;
      lastListingId = null;
      const hover = buildRowHover(sectionId, rowId);
      syncHoverFromMapRef.current(hover);
      onHoverRef.current(hover);
    }

    function handleSeatHover(e: MapLayerMouseEvent) {
      if (isMobileRef.current) return;
      if (!e.features?.[0]) return;
      const feature = e.features[0];
      if (feature.state?.unavailable) return;

      const seatId = feature.properties?.id as string;
      if (!seatId) return;

      cancelPendingLeave();

      // Resolve all seat IDs for this listing (multi-seat listings hover together)
      const listing = listingsBySeatIdRef.current.get(seatId);
      const nextSeatIds = listing ? listing.seatIds : [seatId];

      // Skip if same set of seats already hovered
      if (hoveredSeatIds.length === nextSeatIds.length && nextSeatIds.every((id) => hoveredSeatIds.includes(id))) return;

      // Clear previous hovered seats + connector
      for (const id of hoveredSeatIds) {
        map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: false });
      }
      setConnectorState(hoveredConnectorId, { hovered: false });
      hoveredConnectorId = null;

      hoveredSeatIds = nextSeatIds;
      for (const id of hoveredSeatIds) {
        map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: true });
      }
      // Set connector hover
      if (listing) {
        hoveredConnectorId = listing.listingId;
        setConnectorState(listing.listingId, { hovered: true });
      }
      map.getCanvas().style.cursor = 'pointer';

      // Emit listing-level hover so seat-mode pins anchor to the actual listing
      const sectionId = feature.properties?.sectionId as string;
      const rowId = feature.properties?.rowId as string;
      if (
        listing &&
        sectionId &&
        rowId &&
        (
          lastListingId !== listing.listingId ||
          lastSectionId !== sectionId ||
          lastRowId !== rowId
        )
      ) {
        lastSectionId = sectionId;
        lastRowId = rowId;
        lastListingId = listing.listingId;
        const hover = buildListingHover(sectionId, listing.listingId);
        syncHoverFromMapRef.current(hover);
        onHoverRef.current(hover);
      }
    }

    function handleConnectorHover(e: MapLayerMouseEvent) {
      if (isMobileRef.current) return;
      if (!e.features?.[0]) return;

      const listingId = e.features[0].properties?.listingId as string;
      if (!listingId) return;

      cancelPendingLeave();

      // Skip if same listing already hovered
      if (hoveredConnectorId === listingId) return;

      const listing = listingsById.get(listingId);
      if (!listing) return;

      // Clear previous
      for (const id of hoveredSeatIds) {
        map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: false });
      }
      setConnectorState(hoveredConnectorId, { hovered: false });

      // Set new hover — same as handleSeatHover
      hoveredSeatIds = listing.seatIds;
      for (const id of hoveredSeatIds) {
        map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: true });
      }
      hoveredConnectorId = listing.listingId;
      setConnectorState(listing.listingId, { hovered: true });
      map.getCanvas().style.cursor = 'pointer';

      const sectionId = listing.sectionId;
      const rowId = listing.rowId;
      if (
        sectionId &&
        rowId &&
        (
          lastListingId !== listing.listingId ||
          lastSectionId !== sectionId ||
          lastRowId !== rowId
        )
      ) {
        lastSectionId = sectionId;
        lastRowId = rowId;
        lastListingId = listing.listingId;
        const hover = buildListingHover(sectionId, listing.listingId);
        syncHoverFromMapRef.current(hover);
        onHoverRef.current(hover);
      }
    }

    function handleConnectorClick(e: MapLayerMouseEvent) {
      if (!e.features?.[0]) return;
      const listingId = e.features[0].properties?.listingId as string;
      if (!listingId) return;
      const listing = listingsById.get(listingId);
      if (!listing) return;

      onSelectRef.current({
        sectionId: listing.sectionId,
        rowId: listing.rowId ?? null,
        listingId: null,
        seatIds: listing.seatIds,
      });
    }

    function handleMouseLeave() {
      if (isMobileRef.current) return;
      for (const id of hoveredSeatIds) {
        map.setFeatureState({ source: SOURCE_SEATS, id }, { hovered: false });
      }
      setConnectorState(hoveredConnectorId, { hovered: false });
      hoveredConnectorId = null;
      hoveredSeatIds = [];
      lastSectionId = null;
      lastRowId = null;
      lastListingId = null;
      map.getCanvas().style.cursor = '';
      syncHoverFromMapRef.current(EMPTY_HOVER);
      onHoverRef.current(EMPTY_HOVER);
    }

    // Seat/connector mouseleave: use a short grace window so brief pointer gaps
    // between the seat hit target and connector do not clear hover immediately.
    function handleSeatConnectorMouseLeave() {
      if (isMobileRef.current) return;
      if (hoveredSeatIds.length === 0) return;
      cancelPendingLeave();
      pendingLeaveTimeout = window.setTimeout(() => {
        pendingLeaveTimeout = null;
        handleMouseLeave();
      }, HOVER_EXIT_GRACE_MS);
    }

    // Background click — deselects when clicking outside any interactive layer.
    // queryRenderedFeatures guards against double-firing when a layer click already handled it.
    function handleBackgroundClick(e: MapLayerMouseEvent) {
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_SECTION, LAYER_ROW, LAYER_SEAT, LAYER_SEAT_CONNECTOR],
      });
      if (hits.length > 0) return;
      onSelectRef.current(EMPTY_SELECTION);
      onHoverRef.current(EMPTY_HOVER);
    }

    // Register handlers
    map.on('click', handleBackgroundClick);
    map.on('click', LAYER_SECTION, handleSectionClick);
    map.on('click', LAYER_ROW, handleRowClick);
    map.on('click', LAYER_SEAT, handleSeatClick);
    map.on('click', LAYER_SEAT_CONNECTOR, handleConnectorClick);

    map.on('mousemove', LAYER_SECTION, handleSectionHover);
    map.on('mousemove', LAYER_ROW, handleRowHover);
    map.on('mousemove', LAYER_SEAT_INTERACTION, handleSeatHover);
    map.on('mousemove', LAYER_SEAT_CONNECTOR, handleConnectorHover);

    map.on('mouseleave', LAYER_SECTION, handleMouseLeave);
    map.on('mouseleave', LAYER_ROW, handleMouseLeave);
    map.on('mouseleave', LAYER_SEAT_INTERACTION, handleSeatConnectorMouseLeave);
    map.on('mouseleave', LAYER_SEAT_CONNECTOR, handleSeatConnectorMouseLeave);

    return () => {
      cancelPendingLeave();
      map.off('click', handleBackgroundClick);
      map.off('click', LAYER_SECTION, handleSectionClick);
      map.off('click', LAYER_ROW, handleRowClick);
      map.off('click', LAYER_SEAT, handleSeatClick);
      map.off('click', LAYER_SEAT_CONNECTOR, handleConnectorClick);

      map.off('mousemove', LAYER_SECTION, handleSectionHover);
      map.off('mousemove', LAYER_ROW, handleRowHover);
      map.off('mousemove', LAYER_SEAT_INTERACTION, handleSeatHover);
      map.off('mousemove', LAYER_SEAT_CONNECTOR, handleConnectorHover);

      map.off('mouseleave', LAYER_SECTION, handleMouseLeave);
      map.off('mouseleave', LAYER_ROW, handleMouseLeave);
      map.off('mouseleave', LAYER_SEAT_INTERACTION, handleSeatConnectorMouseLeave);
      map.off('mouseleave', LAYER_SEAT_CONNECTOR, handleSeatConnectorMouseLeave);
    };
  }, [ready, mapRef]);
}
