import { useEffect, useMemo, useRef } from 'react';
import type { VenueSeatMapModel } from '../seatMap/mock/createVenueSeatMapModel';
import type { SeatColors, SelectionState, HoverState, DisplayMode, PinData, Listing } from '../seatMap/model/types';
import type { PinDensityConfig } from '../seatMap/config/types';
import { Pin } from './Pin';
import {
  buildSectionSelection,
  buildSectionHover,
  clearHover,
} from '../seatMap/behavior/rules';
import {
  isDensityEnabled,
  getDensityPinSlice,
  getHoverPinTarget,
  isPinVisible,
  getLowestPricePin,
  declutterPins,
} from '../seatMap/behavior/pins';
import type { HoverPinTarget } from '../seatMap/behavior/pins';
import { createMutationManager } from '../seatMap/behavior/domMutation';
import { resolveInteractionState, resolveSectionFill } from '../seatMap/behavior/visualState';
import {
  computeVisibleSections,
  resolveTargetPosition,
  buildSelectedPinTarget,
  SEAT_RADIUS,
} from './realVenueHelpers';
import type { ViewportRect } from './realVenueHelpers';
import { RealVenueSeats } from './RealVenueSeats';
import { useTapHandler } from './useTapHandler';
import type { RealVenueSeatsHandle } from './RealVenueSeats';

// Re-export for consumers (SeatMapRoot imports these from here)
export type { ViewportRect } from './realVenueHelpers';
export { computeVisibleSections } from './realVenueHelpers';

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
  venueStrokeWidth: number;
  selectedListing?: Listing | null;
  listingsBySection?: Map<string, Listing[]>;
  dealColorOverrides?: Map<string, string> | null;
  zoneRowDisplay?: 'rows' | 'seats';
  isMobile?: boolean;
  seatRadius?: number;
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
  venueStrokeWidth,
  selectedListing = null,
  listingsBySection,
  dealColorOverrides = null,
  zoneRowDisplay = 'seats',
  isMobile = false,
  seatRadius = SEAT_RADIUS,
}: RealVenueProps) {
  const { geometry } = model;
  const { frameWidth, frameHeight } = geometry;

  // Two mutation managers for section boundary fill + fill-opacity (DOM mutation avoids re-rendering all 69 sections)
  const sectionFillMutations = useRef(createMutationManager());
  const sectionOpacityMutations = useRef(createMutationManager());
  // Track the hovered label element for restore on mouse leave
  const hoveredLabelRef = useRef<SVGTextElement | null>(null);
  const hoveredLabelOriginalFillRef = useRef<string | null>(null);

  // When selection changes, React re-renders section fills with correct colors.
  // Discard stale hover/pressed state so leave handlers don't restore pre-selection colors.
  useEffect(() => {
    sectionFillMutations.current.discardAll();
    sectionOpacityMutations.current.discardAll();
    hoveredLabelRef.current = null;
    hoveredLabelOriginalFillRef.current = null;
  }, [selection.sectionId]);

  // Imperative handle to push panel hover into RealVenueSeats without re-rendering it
  const seatsHandleRef = useRef<RealVenueSeatsHandle>(null);

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

      // Pins stay mounted in all modes. isHovered flag + seat-view props handle hover appearance.
      const pinVisibilityContext = {
        displayMode,
        pins: sectionPins,
        sectionId,
        selectedListing,
        hoverTarget: null,
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

        const isHovered = hoverPinTarget?.listing.listingId === pin.listing.listingId;

        pins.push({ pin, x, y, sectionId, isHovered });
      }
    }

    const currentDensity =
      displayMode === 'sections' ? pinDensity.sections
      : displayMode === 'rows' ? pinDensity.rows
      : pinDensity.seats;
    return declutterPins(pins, displayMode, currentDensity, isMobile);
  }, [pinsBySection, geometry.seatPositions, geometry.sectionBoundaries, visibleSections, displayMode, pinDensity, selectedListing, hoverPinTarget, hoverState.sectionId, isMobile]);

  // Mobile: show roughly half the pins to reduce clutter
  const visiblePinElements = useMemo(() => {
    if (!isMobile) return pinElements;
    return pinElements.slice(0, Math.ceil(pinElements.length / 2));
  }, [pinElements, isMobile]);

  // Push panel hover changes to RealVenueSeats via imperative handle (no re-render)
  useEffect(() => {
    if (displayMode === 'sections') return;
    seatsHandleRef.current?.applyPanelHover(hoverState, seatColors, seatColorsBySection);
  }, [hoverState, displayMode, seatColors, seatColorsBySection]);

  // Keep latest seatColors in a ref for use in section boundary event handlers
  const seatColorsRef = useRef(seatColors);
  seatColorsRef.current = seatColors;
  const sectionColorsMapRef = useRef(seatColorsBySection);
  sectionColorsMapRef.current = seatColorsBySection;

  const sectionTap = useTapHandler<string>({
    onTap: (sectionId) => onSelect(buildSectionSelection(sectionId)),
    onPressStart: (sectionId, e) => {
      const path = (e.currentTarget as SVGGElement).querySelector('path') as SVGPathElement | null;
      if (!path) return;
      const sectionColors = sectionColorsMapRef.current?.get(sectionId) ?? seatColorsRef.current;
      sectionFillMutations.current.applyPressed([path], 'fill', sectionColors.pressed);
      sectionOpacityMutations.current.applyPressed([path], 'fill-opacity', '1.0');
    },
    onPressEnd: () => {
      sectionFillMutations.current.clearPressed();
      sectionOpacityMutations.current.clearPressed();
    },
    onHoverEnter: (sectionId, e) => {
      const path = (e.currentTarget as SVGGElement).querySelector('path') as SVGPathElement | null;
      if (!path) return;
      const sectionColors = sectionColorsMapRef.current?.get(sectionId) ?? seatColorsRef.current;
      const label = document.getElementById(`section-label-${sectionId}`) as SVGTextElement | null;
      hoveredLabelRef.current = label;
      hoveredLabelOriginalFillRef.current = label?.getAttribute('fill') ?? null;
      sectionFillMutations.current.applyHover([path], 'fill', sectionColors.hover);
      sectionOpacityMutations.current.applyHover([path], 'fill-opacity', '0.85');
      label?.setAttribute('fill', seatColorsRef.current.labelSelected);
      onHover(buildSectionHover(sectionId));
    },
    onHoverLeave: () => {
      // Discard pressed (don't restore — hover restore below returns us to original fill)
      sectionFillMutations.current.discardPressed();
      sectionOpacityMutations.current.discardPressed();
      // Restore to pre-hover (original available) fill
      sectionFillMutations.current.clearHover();
      sectionOpacityMutations.current.clearHover();
      if (hoveredLabelRef.current && hoveredLabelOriginalFillRef.current !== null) {
        hoveredLabelRef.current.setAttribute('fill', hoveredLabelOriginalFillRef.current);
      }
      hoveredLabelRef.current = null;
      hoveredLabelOriginalFillRef.current = null;
      onHover(clearHover());
    },
  });

  return (
    <div style={{ position: 'relative', width: frameWidth, height: frameHeight }}>
      <svg
        width={frameWidth}
        height={frameHeight}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        className="block"
      >
        <defs>
          {geometry.venueElements
            .filter((el) => el.name === 'venue')
            .map((el) => (
              <clipPath key={`clip-${el.name}`} id="venue-clip">
                <path d={el.d} transform={`translate(${el.x}, ${el.y})`} />
              </clipPath>
            ))}
        </defs>

        {/* Venue background elements (fill only — stroke rendered on top of sections) */}
        {geometry.venueElements.map((el) => (
          <g key={el.name} transform={`translate(${el.x}, ${el.y})`}>
            <path
            d={el.d}
            fill={el.name === 'venue' ? seatColors.venueFill : el.fill}
            stroke="none"
          />
          </g>
        ))}

        {/* Sections + seats clipped to venue boundary */}
        <g clipPath="url(#venue-clip)">

        {/* Section boundaries */}
        {Array.from(geometry.sectionBoundaries.entries()).map(([sectionId, boundary]) => {
          const isAvailable = availableSections.has(sectionId);
          const isSelected = selection.sectionId === sectionId;
          // Panel hover via React; local map hover handled by DOM mutation (no state needed)
          const isPanelHovered = hoverState.sectionId === sectionId;
          const sectionColors = seatColorsBySection?.get(sectionId) ?? seatColors;

          // Resolve React-rendered fill — pressed state is DOM-only (isPressed: false here)
          const { fill: fillColor, fillOpacity } = displayMode === 'sections'
            ? resolveSectionFill(
                resolveInteractionState({ isAvailable, isSelected, isPressed: false, isHovered: isPanelHovered }),
                sectionColors,
              )
            : { fill: 'transparent', fillOpacity: 0 };

          const isInteractive = isAvailable && displayMode === 'sections';

          return (
            <g
              key={`boundary-${sectionId}`}
              id={`section-${sectionId}`}
              transform={`translate(${boundary.bx}, ${boundary.by})`}
              className={isInteractive ? 'cursor-pointer' : undefined}
              {...(isInteractive ? sectionTap.getHandlers(sectionId) : {})}
            >
              <path
                d={boundary.d}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={seatColors.sectionStroke}
                strokeWidth={sectionStrokeWidth}
                style={{ transition: 'fill 150ms ease, fill-opacity 150ms ease' }}
              />
            </g>
          );
        })}

        </g>{/* end venue-clip */}

        {/* Venue boundary stroke — rendered on top of sections so stroke is never covered */}
        {venueStrokeWidth > 0 && geometry.venueElements
          .filter((el) => el.name === 'venue')
          .map((el) => (
            <g key={`${el.name}-stroke`} transform={`translate(${el.x}, ${el.y})`}>
              <path
                d={el.d}
                fill="none"
                stroke={seatColors.venueStroke}
                strokeWidth={venueStrokeWidth}
              />
            </g>
          ))}

        {/* Seats/rows - only in zoomed modes, with viewport culling */}
        {displayMode !== 'sections' && (
          <RealVenueSeats
            ref={seatsHandleRef}
            geometry={geometry}
            model={model}
            seatColors={seatColors}
            seatColorsBySection={seatColorsBySection}
            displayMode={displayMode}
            selection={selection}
            onSelect={onSelect}
            onHover={onHover}
            visibleSections={visibleSections}
            connectorWidth={connectorWidth}
            dealColorOverrides={dealColorOverrides}
            listingsBySection={listingsBySection}
            zoneRowDisplay={zoneRowDisplay}
            seatRadius={seatRadius}
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

          // Use seat centroid for label position — more accurate than bbox center for arc-shaped sections
          let labelX = boundary.bx + boundary.bw / 2;
          let labelY = boundary.by + boundary.bh / 2;
          const seatRows = geometry.seatPositions.get(sectionId);
          if (seatRows && seatRows.length > 0) {
            let sumX = 0, sumY = 0, count = 0;
            for (const row of seatRows) {
              for (let i = 0; i < row.length; i += 2) { sumX += row[i]; sumY += row[i + 1]; count++; }
            }
            if (count > 0) { labelX = sumX / count; labelY = sumY / count; }
          }

          // Format display label: vip_01 → VIP 1, others as-is
          const displayLabel = sectionId.startsWith('vip_')
            ? `VIP ${parseInt(sectionId.slice(4), 10)}`
            : sectionId;

          // Detect side/curved sections that need rotated labels
          const isLeftSide = sectionId.endsWith('L') || sectionId === '101';
          const isRightSide = sectionId.endsWith('R') || sectionId === '105';
          const isSide = isLeftSide || isRightSide;
          const isVip = sectionId.startsWith('vip_');
          const fontSize = isSide ? 55 : isVip ? 55 : 80;

          // Compute rotation for curved side sections so labels follow the arc
          let rotation = 0;
          if (isSide && seatRows && seatRows.length >= 3) {
            const mid = Math.floor(seatRows.length / 2);
            const prev = seatRows[mid - 1];
            const next = seatRows[mid + 1];
            if (prev.length >= 2 && next.length >= 2) {
              const dx = next[0] - prev[0];
              const dy = next[1] - prev[1];
              let angle = Math.atan2(dy, dx) * (180 / Math.PI);
              // Normalize: keep text right-side-up
              if (angle > 90) angle -= 180;
              if (angle < -90) angle += 180;
              // Force letter tops toward venue center: left sections negative, right sections positive
              rotation = isLeftSide ? -Math.abs(angle) : Math.abs(angle);
            }
          }

          // Per-section label nudge overrides — edit these to fine-tune individual label positions
          // rotation: added to the computed arc rotation (degrees); positive = clockwise
          const LABEL_NUDGE: Record<string, { x?: number; y?: number; rotation?: number }> = {
            '100L': { x: 0, y: 0, rotation: 0 },
            '100R': { x: 0, y: 0, rotation: 0 },
            '200L': { x: -60, y: 0, rotation: -30 },
            '200R': { x: 60, y: 0, rotation: 30 },
            '300L': { x: -40, y: 0, rotation: -60 },
            '300R': { x: 40, y: 0, rotation: 60 },
          };
          const nudge = LABEL_NUDGE[sectionId];
          if (nudge) { labelX += nudge.x ?? 0; labelY += nudge.y ?? 0; rotation += nudge.rotation ?? 0; }

          return (
            <text
              key={`label-${sectionId}`}
              id={`section-label-${sectionId}`}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="central"
              fill={labelColor}
              fontSize={fontSize}
              fontWeight={700}
              fontFamily="GT Walsheim, sans-serif"
              textRendering="geometricPrecision"
              style={{ pointerEvents: 'none' }}
              transform={rotation ? `rotate(${rotation} ${labelX} ${labelY})` : undefined}
            >
              {displayLabel}
            </text>
          );
        })}
      </svg>

      {/* Pin overlays - DOM elements positioned absolutely over the SVG */}
      {visiblePinElements.map(({ pin, x, y, isHovered }) => (
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
          useTransition
          seatViewUrl={pin.listing.seatViewUrl}
          sectionLabel={pin.listing.sectionLabel}
          rowNumber={pin.listing.rowNumber}
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

      {/* Hover pin overlay — falls back to overlay when no default pin is covering the hover. */}
      {hoverPinPos && hoverPinTarget && !visiblePinElements.some(el => el.isHovered) && (
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
