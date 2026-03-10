import { memo, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { VenueGeometry, VenueSeatMapModel } from '../seatMap/mock/createVenueSeatMapModel';
import type { SeatColors, SelectionState, HoverState, DisplayMode, Listing } from '../seatMap/model/types';
import {
  buildRowSelection,
  buildRowHover,
  buildListingSelection,
  buildListingHover,
  clearHover,
} from '../seatMap/behavior/rules';
import { createMutationManager, findHoverTargets } from '../seatMap/behavior/domMutation';
import { SEAT_RADIUS } from './realVenueHelpers';

// Imperative handle so the parent can apply panel hover without triggering re-renders
export interface RealVenueSeatsHandle {
  applyPanelHover: (hover: HoverState, colors: SeatColors, sectionColors?: Map<string, SeatColors> | null) => void;
}

// Separate component for seats to isolate re-renders — memo skips re-renders when props are stable.
// Hover and pressed visuals are handled via direct DOM mutation (not React state) to avoid
// re-rendering ~18K SVG elements on every mouse move. Only selection changes trigger re-renders.
export const RealVenueSeats = memo(forwardRef<RealVenueSeatsHandle, {
  geometry: VenueGeometry;
  model: VenueSeatMapModel;
  seatColors: SeatColors;
  seatColorsBySection?: Map<string, SeatColors> | null;
  displayMode: DisplayMode;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  onHover: (hover: HoverState) => void;
  visibleSections: Set<string> | null;
  connectorWidth: number;
  dealColorOverrides?: Map<string, string> | null;
  listingsBySection?: Map<string, Listing[]>;
  zoneRowDisplay?: 'rows' | 'seats';
  seatRadius?: number;
}>(function RealVenueSeats({
  geometry,
  model,
  seatColors,
  seatColorsBySection,
  displayMode,
  selection,
  onSelect,
  onHover,
  visibleSections,
  connectorWidth,
  dealColorOverrides,
  listingsBySection,
  zoneRowDisplay = 'seats',
  seatRadius = SEAT_RADIUS,
}, ref) {
  const wrapperRef = useRef<SVGGElement>(null);

  // Two managers: fills (circles) and strokes (polylines, connectors)
  const fillMutations = useRef(createMutationManager());
  const strokeMutations = useRef(createMutationManager());

  // Keep latest colors in refs so DOM mutation callbacks don't go stale
  const colorsRef = useRef(seatColors);
  colorsRef.current = seatColors;
  const sectionColorsRef = useRef(seatColorsBySection);
  sectionColorsRef.current = seatColorsBySection;

  // When selection changes, React re-renders circles with correct colors.
  // Discard stale hover state so clearHover doesn't restore pre-selection colors.
  useEffect(() => {
    fillMutations.current.discardAll();
    strokeMutations.current.discardAll();
  }, [selection.rowId, selection.listingId]);

  const applyHoverDOM = useCallback((hover: HoverState, sc: SeatColors) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Build a synthetic dataset to reuse findHoverTargets
    const dataset: DOMStringMap = {} as DOMStringMap;
    if (hover.rowId && !hover.listingId) {
      dataset.rowId = hover.rowId;
      // Check if it's a zone row or regular row — try zone row first
      const zoneEl = wrapper.querySelector(`[data-row-id="${hover.rowId}"][data-is-zone-row]`);
      if (zoneEl) dataset.isZoneRow = 'true';
      else dataset.isRow = 'true';
    } else if (hover.listingId) {
      dataset.listingId = hover.listingId;
    } else {
      return;
    }

    const { fills, strokes } = findHoverTargets(wrapper, dataset);
    if (fills.length > 0) fillMutations.current.applyHover(fills, 'fill', sc.hover);
    if (strokes.length > 0) strokeMutations.current.applyHover(strokes, 'stroke', hover.listingId ? sc.connectorHover : sc.hover);
  }, []);

  const clearHoverDOM = useCallback(() => {
    fillMutations.current.clearHover();
    strokeMutations.current.clearHover();
  }, []);

  // Expose imperative handle for panel hover
  useImperativeHandle(ref, () => ({
    applyPanelHover: (hover: HoverState, colors: SeatColors, sectionColors?: Map<string, SeatColors> | null) => {
      clearHoverDOM();
      if (!hover.sectionId && !hover.listingId) return;
      const sc = (hover.sectionId ? sectionColors?.get(hover.sectionId) : undefined) ?? colors;
      applyHoverDOM(hover, sc);
    },
  }), [applyHoverDOM, clearHoverDOM]);

  // Build listing lookup for click
  const seatToListing = useMemo(() => {
    const map = new Map<string, { listingId: string; seatIds: string[] }>();
    for (const [, sectionData] of model.sectionDataById) {
      for (const row of sectionData.rows) {
        for (const seat of row.seats) {
          if (seat.listingId) {
            const existing = map.get(seat.listingId);
            if (existing) {
              existing.seatIds.push(seat.seatId);
            } else {
              map.set(seat.listingId, { listingId: seat.listingId, seatIds: [seat.seatId] });
            }
          }
        }
      }
    }
    return map;
  }, [model.sectionDataById]);

  // O(1) lookup for selected seats
  const selectedSeatSet = useMemo(
    () => new Set(selection.seatIds),
    [selection.seatIds]
  );

  // For deal theme rows mode: cheapest listing per row → deal color
  const rowDealColors = useMemo(() => {
    if (!dealColorOverrides || displayMode !== 'rows') return null;
    const result = new Map<string, string>();
    for (const [, sectionListings] of listingsBySection ?? []) {
      const cheapestByRow = new Map<string, { price: number; listingId: string }>();
      for (const listing of sectionListings) {
        if (!listing.rowId) continue;
        const existing = cheapestByRow.get(listing.rowId);
        if (!existing || listing.price < existing.price) {
          cheapestByRow.set(listing.rowId, { price: listing.price, listingId: listing.listingId });
        }
      }
      for (const [rowId, { listingId }] of cheapestByRow) {
        const color = dealColorOverrides.get(listingId);
        if (color) result.set(rowId, color);
      }
    }
    return result;
  }, [dealColorOverrides, displayMode, listingsBySection]);

  // Event delegation handlers — single handler on <g> wrapper instead of 18K individual handlers
  const handleSeatClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset) return;

    // Row-level click (polylines in rows mode or zone rows)
    if (dataset.rowId && dataset.sectionId && (dataset.isRow || dataset.isZoneRow)) {
      if (dataset.available === 'false') return;
      onSelect(buildRowSelection(dataset.sectionId, dataset.rowId));
      return;
    }

    // Seat-level click
    if (dataset.listingId && dataset.sectionId && dataset.rowId) {
      if (dataset.available === 'false') return;
      const listing = seatToListing.get(dataset.listingId);
      if (listing) {
        onSelect(buildListingSelection(dataset.sectionId, listing.listingId, listing.seatIds, dataset.rowId));
      }
    }
  }, [onSelect, seatToListing]);

  const handleSeatMouseOver = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset || dataset.available === 'false') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Clear previous hover
    clearHoverDOM();

    const sc = (dataset.sectionId ? sectionColorsRef.current?.get(dataset.sectionId) : undefined) ?? colorsRef.current;

    // Row-level hover
    if (dataset.rowId && dataset.sectionId && (dataset.isRow || dataset.isZoneRow)) {
      const { strokes } = findHoverTargets(wrapper, dataset);
      if (strokes.length > 0) strokeMutations.current.applyHover(strokes, 'stroke', sc.hover);
      onHover(buildRowHover(dataset.sectionId, dataset.rowId));
      return;
    }

    // Seat-level hover
    if (dataset.listingId && dataset.sectionId && dataset.rowId) {
      const { fills, strokes } = findHoverTargets(wrapper, dataset);
      if (fills.length > 0) fillMutations.current.applyHover(fills, 'fill', sc.hover);
      if (strokes.length > 0) strokeMutations.current.applyHover(strokes, 'stroke', sc.connectorHover);
      onHover(buildListingHover(dataset.sectionId, dataset.listingId));
    }
  }, [onHover, clearHoverDOM]);

  const handleSeatMouseOut = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset || dataset.available === 'false') return;

    if (dataset.isRow || dataset.isZoneRow || dataset.listingId || dataset.seatId) {
      clearHoverDOM();
      onHover(clearHover());
    }
  }, [onHover, clearHoverDOM]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset || dataset.available === 'false') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const sc = (dataset.sectionId ? sectionColorsRef.current?.get(dataset.sectionId) : undefined) ?? colorsRef.current;

    if ((dataset.isRow === 'true' || dataset.isZoneRow === 'true') && dataset.rowId) {
      const { strokes } = findHoverTargets(wrapper, dataset);
      if (strokes.length > 0) strokeMutations.current.applyPressed(strokes, 'stroke', sc.pressed);
    } else if (dataset.listingId) {
      const { fills, strokes } = findHoverTargets(wrapper, dataset);
      if (fills.length > 0) fillMutations.current.applyPressed(fills, 'fill', sc.pressed);
      if (strokes.length > 0) strokeMutations.current.applyPressed(strokes, 'stroke', sc.connectorPressed);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    fillMutations.current.clearPressed();
    strokeMutations.current.clearPressed();
  }, []);

  return (
    <g
      ref={wrapperRef}
      onClick={handleSeatClick}
      onMouseOver={handleSeatMouseOver}
      onMouseOut={handleSeatMouseOut}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {Array.from(geometry.seatPositions.entries()).map(([sectionId, rows]) => {
        // Viewport culling: skip sections not in view
        if (visibleSections && !visibleSections.has(sectionId)) return null;

        const sectionData = model.sectionDataById.get(sectionId);
        if (!sectionData) return null;

        const sc = seatColorsBySection?.get(sectionId) ?? seatColors;

        return rows.map((flatCoords, rowIndex) => {
          const rowData = sectionData.rows[rowIndex];
          if (!rowData) return null;
          const seatCount = flatCoords.length / 2;

          if (displayMode === 'rows') {
            const points = Array.from({ length: seatCount }, (_, i) =>
              `${flatCoords[i * 2]},${flatCoords[i * 2 + 1]}`
            ).join(' ');

            const hasAvailable = rowData.seats.some((s) => s.status === 'available');
            const isRowSelected = selection.rowId === rowData.rowId;

            let strokeColor: string;
            if (!hasAvailable) {
              strokeColor = sc.unavailable;
            } else if (isRowSelected) {
              strokeColor = sc.selected;
            } else {
              strokeColor = rowDealColors?.get(rowData.rowId) ?? sc.available;
            }

            return (
              <polyline
                key={`row-${sectionId}-${rowIndex}`}
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={seatRadius * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={hasAvailable ? 'cursor-pointer' : undefined}
                data-is-row="true"
                data-section-id={sectionId}
                data-row-id={rowData.rowId}
                data-available={String(hasAvailable)}
              />
            );
          }

          // Seats mode: zone rows render as polylines when zoneRowDisplay === 'rows'
          if (rowData.isZoneRow && zoneRowDisplay === 'rows') {
            const points = Array.from({ length: seatCount }, (_, i) =>
              `${flatCoords[i * 2]},${flatCoords[i * 2 + 1]}`
            ).join(' ');

            const hasAvailable = rowData.seats.some(s => s.status === 'available');
            const isRowSelected = selection.rowId === rowData.rowId;

            let strokeColor: string;
            if (!hasAvailable) {
              strokeColor = sc.unavailable;
            } else if (isRowSelected) {
              strokeColor = sc.selected;
            } else {
              strokeColor = sc.available;
            }

            return (
              <polyline
                key={`zonerow-${sectionId}-${rowIndex}`}
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={seatRadius * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={hasAvailable ? 'cursor-pointer' : undefined}
                data-is-zone-row="true"
                data-section-id={sectionId}
                data-row-id={rowData.rowId}
                data-available={String(hasAvailable)}
              />
            );
          }

          // Seats mode: connectors first (behind seats), then circles
          // Renders base colors only — hover/pressed are applied via DOM mutation
          const connectors: React.ReactElement[] = [];
          const circles: React.ReactElement[] = [];

          for (let seatIndex = 0; seatIndex < seatCount; seatIndex++) {
            const seat = rowData.seats[seatIndex];
            if (!seat) continue;
            const cx = flatCoords[seatIndex * 2];
            const cy = flatCoords[seatIndex * 2 + 1];
            const isAvailable = seat.status === 'available';
            const isSelected = selectedSeatSet.has(seat.seatId);

            let color: string;
            if (!isAvailable) {
              color = sc.unavailable;
            } else if (isSelected) {
              color = sc.selected;
            } else if (dealColorOverrides && seat.listingId) {
              color = dealColorOverrides.get(seat.listingId) ?? sc.available;
            } else {
              color = sc.available;
            }

            // Connector to next seat if same listing
            if (seatIndex < seatCount - 1) {
              const nextSeat = rowData.seats[seatIndex + 1];
              if (seat.listingId && nextSeat?.listingId === seat.listingId) {
                const nx = flatCoords[(seatIndex + 1) * 2];
                const ny = flatCoords[(seatIndex + 1) * 2 + 1];
                let connColor = sc.connector;
                if (isSelected) connColor = sc.connectorSelected;
                else if (dealColorOverrides && seat.listingId) {
                  connColor = dealColorOverrides.get(seat.listingId) ?? sc.connector;
                }

                connectors.push(
                  <line
                    key={`conn-${seat.seatId}`}
                    x1={cx}
                    y1={cy}
                    x2={nx}
                    y2={ny}
                    stroke={connColor}
                    strokeWidth={connectorWidth}
                    data-listing-id={seat.listingId}
                    data-section-id={sectionId}
                    data-row-id={rowData.rowId}
                    data-available="true"
                  />
                );
              }
            }

            circles.push(
              <circle
                key={seat.seatId}
                cx={cx}
                cy={cy}
                r={seatRadius}
                fill={color}
                className={isAvailable ? 'cursor-pointer' : undefined}
                data-seat-id={seat.seatId}
                data-section-id={sectionId}
                data-row-id={rowData.rowId}
                data-listing-id={seat.listingId || undefined}
                data-available={String(isAvailable)}
              />
            );
          }

          return (
            <g key={`seats-${sectionId}-${rowIndex}`}>
              {connectors}
              {circles}
            </g>
          );
        });
      })}
    </g>
  );
}));
