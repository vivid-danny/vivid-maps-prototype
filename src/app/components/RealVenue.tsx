import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { VenueGeometry, VenueSeatMapModel } from '../seatMap/mock/createVenueSeatMapModel';
import type { SeatColors, SelectionState, HoverState, DisplayMode, PinData, Listing } from '../seatMap/model/types';
import type { PinDensityConfig } from '../seatMap/config/types';
import { Pin } from './Pin';
import {
  buildSectionSelection,
  buildSectionHover,
  buildRowSelection,
  buildRowHover,
  clearHover,
} from '../seatMap/behavior/rules';
import {
  isDensityEnabled,
  getDensityPinSlice,
  getHoverPinTarget,
  isPinVisible,
  getLowestPricePin,
} from '../seatMap/behavior/pins';
import type { HoverPinTarget } from '../seatMap/behavior/pins';
import { parseSeatId } from '../seatMap/behavior/utils';

export interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RealVenueProps {
  model: VenueSeatMapModel;
  seatColors: SeatColors;
  seatColorsBySection?: Map<string, SeatColors> | null;
  displayMode: DisplayMode;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  hoverState: HoverState;
  onHover: (hover: HoverState) => void;
  viewportRect: ViewportRect | null;
  pinsBySection: Map<string, PinData[]>;
  pinDensity: PinDensityConfig;
  connectorWidth: number;
  sectionStrokeWidth: number;
  selectedListing?: Listing | null;
  listingsBySection?: Map<string, Listing[]>;
  dealColorOverrides?: Map<string, string> | null;
  zoneRowDisplay?: 'rows' | 'seats';
}

// Seat size in venue coordinate space
const SEAT_RADIUS = 6;
// Padding around viewport for culling (in venue coords)
const CULL_PADDING = 300;

export function computeVisibleSections(
  geometry: VenueGeometry,
  viewport: ViewportRect | null,
): Set<string> | null {
  if (!viewport) return null; // show all if no viewport yet

  const visible = new Set<string>();
  for (const [sectionId, boundary] of geometry.sectionBoundaries) {
    const sx = boundary.bx - CULL_PADDING;
    const sy = boundary.by - CULL_PADDING;
    const sw = boundary.bw + CULL_PADDING * 2;
    const sh = boundary.bh + CULL_PADDING * 2;

    // AABB intersection
    if (sx + sw > viewport.x && sx < viewport.x + viewport.w &&
        sy + sh > viewport.y && sy < viewport.y + viewport.h) {
      visible.add(sectionId);
    }
  }

  return visible;
}

// Resolve venue-coordinate position for a pin target
function resolveTargetPosition(
  target: HoverPinTarget,
  geometry: VenueGeometry,
): { x: number; y: number } | null {
  const sectionId = target.listing.sectionId;

  if (target.kind === 'section') {
    const boundary = geometry.sectionBoundaries.get(sectionId);
    if (!boundary) return null;
    return { x: boundary.bx + boundary.bw / 2, y: boundary.by + boundary.bh / 2 };
  }

  const seatRows = geometry.seatPositions.get(sectionId);
  if (!seatRows) return null;

  if (target.kind === 'row') {
    const row = seatRows[target.rowIndex];
    if (!row || row.length === 0) return null;
    const midSeat = Math.floor(row.length / 4); // row.length/2 seats, half of that for middle
    return { x: row[midSeat * 2], y: row[midSeat * 2 + 1] };
  }

  // kind === 'seat'
  const row = seatRows[target.rowIndex];
  if (!row || row.length === 0) return null;
  const seatIdx = Math.max(0, Math.min(target.seatIndex, row.length / 2 - 1));
  return { x: row[seatIdx * 2], y: row[seatIdx * 2 + 1] - SEAT_RADIUS };
}

// Build a HoverPinTarget from a selected listing for overlay pin positioning
function buildSelectedPinTarget(
  listing: Listing,
  displayMode: DisplayMode,
  model: VenueSeatMapModel,
): HoverPinTarget | null {
  if (displayMode === 'sections') {
    return { kind: 'section', listing };
  }

  const rowIndex = listing.rowNumber - 1;

  if (displayMode === 'rows') {
    return { kind: 'row', listing, rowIndex };
  }

  // seats mode: zone/unmapped → row center, otherwise specific seat
  const sectionData = model.sectionDataById.get(listing.sectionId);
  const row = sectionData?.rows.find(r => r.rowId === listing.rowId);
  if (row?.isZoneRow || listing.isUnmapped) {
    return { kind: 'row', listing, rowIndex };
  }

  const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
  const seatIndex = middleSeatId ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1 : 0;
  return { kind: 'seat', listing, rowIndex, seatIndex };
}

export function RealVenue({
  model,
  seatColors,
  seatColorsBySection,
  displayMode,
  selection,
  onSelect,
  hoverState,
  onHover,
  viewportRect,
  pinsBySection,
  pinDensity,
  connectorWidth,
  sectionStrokeWidth,
  selectedListing = null,
  listingsBySection,
  dealColorOverrides = null,
  zoneRowDisplay = 'seats',
}: RealVenueProps) {
  const { geometry } = model;
  const { frameWidth, frameHeight } = geometry;

  // DOM ref for hover — mutating path/label attrs directly avoids re-rendering all 69 sections
  const hoveredSectionRef = useRef<{
    path: SVGPathElement;
    label: SVGTextElement | null;
    prevFill: string;
    prevFillOpacity: string;
  } | null>(null);

  // Viewport culling: recompute when viewportRect changes (updated during pan via rAF)
  const visibleSections = useMemo(
    () => computeVisibleSections(geometry, viewportRect),
    [geometry, viewportRect]
  );

  // Build a set of available section IDs (sections with at least one available seat)
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    for (const [sectionId, sectionData] of model.sectionDataById) {
      const hasAvailable = sectionData.rows.some((row) =>
        row.seats.some((seat) => seat.status === 'available')
      );
      if (hasAvailable) set.add(sectionId);
    }
    return set;
  }, [model.sectionDataById]);

  // Compute hover pin target
  const hoverPinTarget = useMemo(() => {
    if (!hoverState.sectionId) return null;
    const sectionListings = listingsBySection?.get(hoverState.sectionId) ?? [];
    return getHoverPinTarget({
      displayMode,
      hoverState,
      sectionId: hoverState.sectionId,
      sectionListings,
      selectedListing,
    });
  }, [hoverState, displayMode, listingsBySection, selectedListing]);

  // Compute selected pin target
  const selectedPinTarget = useMemo(() => {
    if (!selectedListing) return null;
    return buildSelectedPinTarget(selectedListing, displayMode, model);
  }, [selectedListing, displayMode, model]);

  // Resolve positions for overlay pins
  const hoverPinPos = useMemo(() => {
    if (!hoverPinTarget) return null;
    return resolveTargetPosition(hoverPinTarget, geometry);
  }, [hoverPinTarget, geometry]);

  const selectedPinPos = useMemo(() => {
    if (!selectedPinTarget) return null;
    return resolveTargetPosition(selectedPinTarget, geometry);
  }, [selectedPinTarget, geometry]);

  // Compute pin positions in venue coordinates for visible sections
  const pinElements = useMemo(() => {
    const pins: { pin: PinData; x: number; y: number; sectionId: string; isHovered: boolean }[] = [];
    for (const [sectionId, sectionPins] of pinsBySection) {
      if (visibleSections && !visibleSections.has(sectionId)) continue;
      const seatRows = geometry.seatPositions.get(sectionId);
      if (!seatRows) continue;

      let pinsToShow: PinData[];
      if (displayMode === 'sections') {
        // Density gate: skip entire section if density check fails
        if (!isDensityEnabled(sectionId, pinDensity.sections)) continue;
        const cheapest = getLowestPricePin(sectionPins);
        pinsToShow = cheapest ? [cheapest] : [];
      } else if (displayMode === 'rows') {
        pinsToShow = sectionPins.filter(p =>
          isDensityEnabled(p.listing.rowId, pinDensity.rows)
        );
      } else {
        pinsToShow = getDensityPinSlice(sectionPins, pinDensity.seats);
      }

      // In sections mode, the section pin stays mounted and transitions to hover state in-place
      // (avoids the opacity-0 flash from the enter animation on a hover overlay pin).
      // In rows/seats mode, the hover overlay pin handles hover — hide the regular pin as before.
      const pinVisibilityContext = {
        displayMode,
        pins: sectionPins,
        sectionId,
        selectedListing,
        hoverTarget: displayMode === 'sections' ? null : (hoverState.sectionId === sectionId ? hoverPinTarget : null),
      };

      for (const pin of pinsToShow) {
        if (!isPinVisible(pin, pinVisibilityContext)) continue;

        let x: number, y: number;
        if (displayMode === 'sections') {
          const boundary = geometry.sectionBoundaries.get(sectionId);
          if (!boundary) continue;
          x = boundary.bx + boundary.bw / 2;
          y = boundary.by + boundary.bh / 2;
        } else {
          const row = seatRows[pin.rowIndex];
          if (!row) continue;
          const seatIdx = Math.min(pin.seatIndex, row.length / 2 - 1);
          x = row[seatIdx * 2];
          y = row[seatIdx * 2 + 1];
        }

        const isHovered = displayMode === 'sections' &&
          hoverPinTarget?.listing.listingId === pin.listing.listingId;

        pins.push({ pin, x, y, sectionId, isHovered });
      }
    }
    return pins;
  }, [pinsBySection, geometry.seatPositions, geometry.sectionBoundaries, visibleSections, displayMode, pinDensity, selectedListing, hoverPinTarget, hoverState.sectionId]);

  return (
    <div style={{ position: 'relative', width: frameWidth, height: frameHeight }}>
      <svg
        width={frameWidth}
        height={frameHeight}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        className="block"
      >
        {/* Venue background elements */}
        {geometry.venueElements.map((el) => (
          <g key={el.name} transform={`translate(${el.x}, ${el.y})`}>
            <path
            d={el.d}
            fill={el.name === 'venue' ? seatColors.venueFill : el.fill}
            stroke={el.name === 'venue' ? seatColors.venueStroke : 'none'}
            strokeWidth={el.name === 'venue' ? 1 : undefined}
          />
          </g>
        ))}

        {/* Section boundaries */}
        {Array.from(geometry.sectionBoundaries.entries()).map(([sectionId, boundary]) => {
          const isAvailable = availableSections.has(sectionId);
          const isSelected = selection.sectionId === sectionId;
          // Panel hover via React; local map hover handled by DOM mutation (no state needed)
          const isPanelHovered = hoverState.sectionId === sectionId;
          const sectionColors = seatColorsBySection?.get(sectionId) ?? seatColors;

          let fillColor: string;
          let fillOpacity: number;
          if (displayMode === 'sections') {
            if (!isAvailable) {
              fillColor = sectionColors.unavailable;
              fillOpacity = 0.8;
            } else if (isSelected) {
              fillColor = sectionColors.selected;
              fillOpacity = 1.0;
            } else if (isPanelHovered) {
              fillColor = sectionColors.hover;
              fillOpacity = 0.85;
            } else {
              fillColor = sectionColors.available;
              fillOpacity = 1.0;
            }
          } else {
            fillColor = 'transparent';
            fillOpacity = 0;
          }

          return (
            <g
              key={`boundary-${sectionId}`}
              id={`section-${sectionId}`}
              transform={`translate(${boundary.bx}, ${boundary.by})`}
              className={isAvailable && displayMode === 'sections' ? 'cursor-pointer' : undefined}
              onClick={isAvailable && displayMode === 'sections' ? () => onSelect(buildSectionSelection(sectionId)) : undefined}
              onMouseEnter={isAvailable && displayMode === 'sections' ? (e) => {
                const path = (e.currentTarget as SVGGElement).querySelector('path') as SVGPathElement | null;
                if (path) {
                  hoveredSectionRef.current = {
                    path,
                    label: document.getElementById(`section-label-${sectionId}`) as SVGTextElement | null,
                    prevFill: path.getAttribute('fill') ?? '',
                    prevFillOpacity: path.getAttribute('fill-opacity') ?? '',
                  };
                  path.setAttribute('fill', sectionColors.hover);
                  path.setAttribute('fill-opacity', '0.85');
                  hoveredSectionRef.current.label?.setAttribute('fill', seatColors.labelSelected);
                }
                onHover(buildSectionHover(sectionId));
              } : undefined}
              onMouseLeave={isAvailable && displayMode === 'sections' ? () => {
                const prev = hoveredSectionRef.current;
                if (prev) {
                  prev.path.setAttribute('fill', prev.prevFill);
                  prev.path.setAttribute('fill-opacity', prev.prevFillOpacity);
                  prev.label?.setAttribute('fill', seatColors.labelDefault);
                  hoveredSectionRef.current = null;
                }
                onHover(clearHover());
              } : undefined}
            >
              <path
                d={boundary.d}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={seatColors.sectionStroke}
                strokeWidth={sectionStrokeWidth}
              />
            </g>
          );
        })}

        {/* Seats/rows - only in zoomed modes, with viewport culling */}
        {displayMode !== 'sections' && (
          <RealVenueSeats
            geometry={geometry}
            model={model}
            seatColors={seatColors}
            seatColorsBySection={seatColorsBySection}
            displayMode={displayMode}
            selection={selection}
            onSelect={onSelect}
            hoverState={hoverState}
            onHover={onHover}
            visibleSections={visibleSections}
            connectorWidth={connectorWidth}
            dealColorOverrides={dealColorOverrides}
            listingsBySection={listingsBySection}
            zoneRowDisplay={zoneRowDisplay}
          />
        )}

        {/* Section labels in sections mode */}
        {displayMode === 'sections' && Array.from(geometry.sectionBoundaries.entries()).map(([sectionId, boundary]) => {
          const isAvailable = availableSections.has(sectionId);
          const isSelected = selection.sectionId === sectionId;
          // Panel hover handled by React; local map hover mutates fill attr directly via DOM
          const isPanelHovered = hoverState.sectionId === sectionId;

          let labelColor: string;
          if (!isAvailable) {
            labelColor = seatColors.labelUnavailable;
          } else if (isSelected || isPanelHovered) {
            labelColor = seatColors.labelSelected;
          } else {
            labelColor = seatColors.labelDefault;
          }

          return (
            <text
              key={`label-${sectionId}`}
              id={`section-label-${sectionId}`}
              x={boundary.bx + boundary.bw / 2}
              y={boundary.by + boundary.bh / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={labelColor}
              fontSize={36}
              fontWeight={700}
              fontFamily="GT Walsheim, sans-serif"
              style={{ pointerEvents: 'none' }}
            >
              {sectionId}
            </text>
          );
        })}
      </svg>

      {/* Pin overlays - DOM elements positioned absolutely over the SVG */}
      {pinElements.map(({ pin, x, y, isHovered }) => (
        <Pin
          key={pin.listing.listingId}
          price={pin.listing.price}
          dealScore={pin.listing.dealScore}
          x={x}
          y={y}
          isHovered={isHovered}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          useTransition={displayMode === 'sections'}
        />
      ))}

      {/* Selected pin overlay */}
      {selectedPinPos && selectedListing && (
        <Pin
          isSelected
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={selectedPinPos.x}
          y={selectedPinPos.y}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          seatViewUrl={selectedListing.seatViewUrl}
          sectionLabel={selectedListing.sectionLabel}
          rowNumber={selectedListing.rowNumber}
        />
      )}

      {/* Hover pin overlay — sections mode handles hover in-place when the section has a pin.
          Fall back to overlay when the section has no pin (e.g. excluded by density). */}
      {hoverPinPos && hoverPinTarget && (displayMode !== 'sections' || !pinElements.some(el => el.isHovered)) && (
        <Pin
          isHovered
          price={hoverPinTarget.listing.price}
          dealScore={hoverPinTarget.listing.dealScore}
          x={hoverPinPos.x}
          y={hoverPinPos.y}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          seatViewUrl={hoverPinTarget.listing.seatViewUrl}
          sectionLabel={hoverPinTarget.listing.sectionLabel}
          rowNumber={hoverPinTarget.listing.rowNumber}
        />
      )}
    </div>
  );
}

// Separate component for seats to isolate re-renders — memo skips re-renders when props are stable
const RealVenueSeats = memo(function RealVenueSeats({
  geometry,
  model,
  seatColors,
  seatColorsBySection,
  displayMode,
  selection,
  onSelect,
  hoverState,
  onHover,
  visibleSections,
  connectorWidth,
  dealColorOverrides,
  listingsBySection,
  zoneRowDisplay = 'seats',
}: {
  geometry: VenueGeometry;
  model: VenueSeatMapModel;
  seatColors: SeatColors;
  seatColorsBySection?: Map<string, SeatColors> | null;
  displayMode: DisplayMode;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  hoverState: HoverState;
  onHover: (hover: HoverState) => void;
  visibleSections: Set<string> | null;
  connectorWidth: number;
  dealColorOverrides?: Map<string, string> | null;
  listingsBySection?: Map<string, Listing[]>;
  zoneRowDisplay?: 'rows' | 'seats';
}) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [pressedTarget, setPressedTarget] = useState<{ type: 'listing' | 'row'; id: string } | null>(null);

  // Build listing lookup for click/hover
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
        onSelect({
          sectionId: dataset.sectionId,
          rowId: dataset.rowId,
          listingId: listing.listingId,
          seatIds: listing.seatIds,
        });
      }
    }
  }, [onSelect, seatToListing]);

  const handleSeatMouseOver = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset) return;

    // Row-level hover
    if (dataset.rowId && dataset.sectionId && (dataset.isRow || dataset.isZoneRow)) {
      if (dataset.available === 'false') return;
      setHoveredRowId(dataset.rowId);
      onHover(buildRowHover(dataset.sectionId, dataset.rowId));
      return;
    }

    // Seat-level hover
    if (dataset.listingId && dataset.sectionId && dataset.rowId) {
      if (dataset.available === 'false') return;
      onHover({
        listingId: dataset.listingId,
        sectionId: dataset.sectionId,
        rowId: dataset.rowId,
      });
    }
  }, [onHover]);

  const handleSeatMouseOut = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset) return;

    if (dataset.isRow || dataset.isZoneRow) {
      if (dataset.available === 'false') return;
      setHoveredRowId(null);
      onHover(clearHover());
      return;
    }

    if (dataset.available !== 'false' && (dataset.listingId || dataset.seatId)) {
      onHover(clearHover());
    }
  }, [onHover]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const el = e.target as SVGElement;
    const dataset = (el as SVGElement & { dataset: DOMStringMap }).dataset;
    if (!dataset || dataset.available === 'false') return;

    if (dataset.isRow === 'true' || dataset.isZoneRow === 'true') {
      if (dataset.rowId) setPressedTarget({ type: 'row', id: dataset.rowId });
    } else if (dataset.listingId) {
      setPressedTarget({ type: 'listing', id: dataset.listingId });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setPressedTarget(null);
  }, []);

  return (
    <g
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
            const isRowHovered = hoveredRowId === rowData.rowId || hoverState.rowId === rowData.rowId;
            const isRowPressed = pressedTarget?.type === 'row' && pressedTarget.id === rowData.rowId;

            let strokeColor: string;
            if (!hasAvailable) {
              strokeColor = sc.unavailable;
            } else if (isRowSelected) {
              strokeColor = sc.selected;
            } else if (isRowPressed) {
              strokeColor = sc.pressed;
            } else if (isRowHovered) {
              strokeColor = sc.hover;
            } else {
              strokeColor = rowDealColors?.get(rowData.rowId) ?? sc.available;
            }

            return (
              <polyline
                key={`row-${sectionId}-${rowIndex}`}
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={SEAT_RADIUS * 2}
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
            const isRowHovered = hoveredRowId === rowData.rowId || hoverState.rowId === rowData.rowId;
            const isRowPressed = pressedTarget?.type === 'row' && pressedTarget.id === rowData.rowId;

            let strokeColor: string;
            if (!hasAvailable) {
              strokeColor = sc.unavailable;
            } else if (isRowSelected) {
              strokeColor = sc.selected;
            } else if (isRowPressed) {
              strokeColor = sc.pressed;
            } else if (isRowHovered) {
              strokeColor = sc.hover;
            } else {
              strokeColor = sc.available;
            }

            return (
              <polyline
                key={`zonerow-${sectionId}-${rowIndex}`}
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth={SEAT_RADIUS * 2}
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
          const connectors: React.ReactElement[] = [];
          const circles: React.ReactElement[] = [];

          for (let seatIndex = 0; seatIndex < seatCount; seatIndex++) {
            const seat = rowData.seats[seatIndex];
            if (!seat) continue;
            const cx = flatCoords[seatIndex * 2];
            const cy = flatCoords[seatIndex * 2 + 1];
            const isAvailable = seat.status === 'available';
            const isSelected = selectedSeatSet.has(seat.seatId);
            const isListingHovered = seat.listingId && hoverState.listingId === seat.listingId;
            const isListingPressed = seat.listingId && pressedTarget?.type === 'listing' && pressedTarget.id === seat.listingId;

            let color: string;
            if (!isAvailable) {
              color = sc.unavailable;
            } else if (isSelected) {
              color = sc.selected;
            } else if (isListingPressed) {
              color = sc.pressed;
            } else if (isListingHovered) {
              color = sc.hover;
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
                else if (isListingPressed) connColor = sc.connectorPressed;
                else if (isListingHovered) connColor = sc.connectorHover;
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
                r={SEAT_RADIUS}
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
});
