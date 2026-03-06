import { useMemo } from 'react';
import { SeatsView } from './SeatsView';
import { RowsView } from './RowsView';
import { SectionView } from './SectionView';
import { Pin } from './Pin';
import { SEAT_SIZE, getSeatRowWidth, getSeatCenter, getSectionHeight } from './constants';
import { parseSeatId } from '../seatMap/behavior/utils';
import {
  buildListingHover,
  buildListingSelection,
  buildRowHover,
  buildRowSelection,
  buildSectionHover,
  buildSectionSelection,
  clearHover,
} from '../seatMap/behavior/rules';
import {
  getHoverPinTarget,
  getLowestPricePin,
  getLowestPricePinsByRow,
  getOverlayPinVisualState,
  getPinVisualState,
  isPinVisible,
  isDensityEnabled,
  getDensityPinSlice,
} from '../seatMap/behavior/pins';
import type { SectionConfig, SectionData, SeatColors, DisplayMode, SelectionState, HoverState, PinData, Listing } from '../seatMap/model/types';
import type { PinDensityConfig } from '../seatMap/config/types';
interface SectionProps {
  config: SectionConfig;
  sectionData: SectionData;
  seatColors: SeatColors;
  displayMode: DisplayMode;
  selection: SelectionState;
  onSelect: (selection: SelectionState) => void;
  hoverState: HoverState;
  onHover: (hover: HoverState) => void;
  connectorWidth?: number;
  hoverTransitionMs?: number;
  pins?: PinData[];
  selectedListing?: Listing | null;
  sectionListings?: Listing[];
  disableHover?: boolean;
  pinDensity?: PinDensityConfig;
  zoneRowDisplay?: 'rows' | 'seats';
  dealColorOverrides?: Map<string, string> | null;
}

export function Section({
  config,
  sectionData,
  seatColors,
  displayMode,
  selection,
  onSelect,
  hoverState,
  onHover,
  connectorWidth = 1,
  hoverTransitionMs = 150,
  pins = [],
  selectedListing = null,
  sectionListings = [],
  disableHover = false,
  pinDensity = { sections: 0.80, rows: 0.45, seats: 0.28 },
  zoneRowDisplay = 'rows',
  dealColorOverrides = null,
}: SectionProps) {
  // Handle section selection (only sets sectionId)
  const handleSelectSection = (sectionId: string) => {
    onSelect(buildSectionSelection(sectionId));
  };

  // Handle row selection (sets sectionId and rowId)
  const handleSelectRow = (rowId: string) => {
    onSelect(buildRowSelection(config.sectionId, rowId));
  };

  // Handle seat/listing selection (sets all levels)
  const handleSelectListing = (listingId: string, seatIds: string[]) => {
    onSelect(buildListingSelection(config.sectionId, listingId, seatIds));
  };

  // Handle zone row selection (row-level, like RowsView)
  const handleSelectZoneRow = (rowId: string) => {
    onSelect(buildRowSelection(config.sectionId, rowId));
  };

  // Handle zone row hover from map
  const handleZoneRowHover = (rowId: string | null) => {
    if (rowId) {
      onHover(buildRowHover(config.sectionId, rowId));
    } else {
      onHover(clearHover());
    }
  };

  // Check if this section is selected (at any level)
  const isSectionSelected = selection.sectionId === config.sectionId;

  // Hover handlers for each display mode
  const handleSectionHover = (hovered: boolean) => {
    if (hovered) {
      onHover(buildSectionHover(config.sectionId));
    } else {
      onHover(clearHover());
    }
  };

  const handleRowHover = (rowId: string | null) => {
    if (rowId) {
      onHover(buildRowHover(config.sectionId, rowId));
    } else {
      onHover(clearHover());
    }
  };

  const handleListingHover = (listingId: string | null) => {
    if (listingId) {
      onHover(buildListingHover(config.sectionId, listingId));
    } else {
      onHover(clearHover());
    }
  };

  // Check external hover state for this section
  const isExternalSectionHover = hoverState.sectionId === config.sectionId;

  // When a listing is hovered from the panel and it belongs to a zone row,
  // derive externalHoveredRowId so zone row block highlights on the map
  const externalHoveredZoneRowId = useMemo(() => {
    if (!isExternalSectionHover || !hoverState.listingId) return null;
    const listing = sectionListings?.find(l => l.listingId === hoverState.listingId);
    if (!listing) return null;
    const row = sectionData.rows.find(r => r.rowId === listing.rowId);
    return row?.isZoneRow ? row.rowId : null;
  }, [isExternalSectionHover, hoverState.listingId, sectionListings, sectionData.rows]);

  const hoverPinTarget = useMemo(() => getHoverPinTarget({
    displayMode,
    hoverState,
    sectionId: config.sectionId,
    sectionListings,
    selectedListing,
  }), [hoverState, displayMode, config.sectionId, sectionListings, selectedListing]);

  // For deal theme rows mode: compute per-row color from cheapest listing in that row
  const rowColorOverrides = useMemo(() => {
    if (!dealColorOverrides || displayMode !== 'rows') return null;
    const cheapestByRow = new Map<string, { price: number; listingId: string }>();
    for (const listing of sectionListings) {
      if (!listing.rowId) continue;
      const existing = cheapestByRow.get(listing.rowId);
      if (!existing || listing.price < existing.price) {
        cheapestByRow.set(listing.rowId, { price: listing.price, listingId: listing.listingId });
      }
    }
    const result = new Map<string, string>();
    for (const [rowId, { listingId }] of cheapestByRow) {
      const color = dealColorOverrides.get(listingId);
      if (color) result.set(rowId, color);
    }
    return result;
  }, [dealColorOverrides, displayMode, sectionListings]);

  // All modes render a single SVG with identical dimensions
  const renderContent = () => {
    switch (displayMode) {
      case 'sections':
        return (
          <SectionView
            section={sectionData}
            seatsPerRow={config.seatsPerRow}
            isSelected={isSectionSelected}
            onSelectSection={handleSelectSection}
            seatColors={seatColors}
            label={config.label}
            externalHover={disableHover ? false : isExternalSectionHover}
            onHoverChange={disableHover ? undefined : handleSectionHover}
            hoverTransitionMs={hoverTransitionMs}
          />
        );
      case 'rows':
        return (
          <RowsView
            section={sectionData}
            seatsPerRow={config.seatsPerRow}
            selectedRowId={isSectionSelected ? selection.rowId : null}
            onSelectRow={handleSelectRow}
            seatColors={seatColors}
            externalHoveredRowId={disableHover ? null : (isExternalSectionHover ? hoverState.rowId : null)}
            onRowHover={disableHover ? undefined : handleRowHover}
            hoverTransitionMs={hoverTransitionMs}
            rowColorOverrides={rowColorOverrides}
          />
        );
      case 'seats':
        return (
          <SeatsView
            section={sectionData}
            seatsPerRow={config.seatsPerRow}
            selectedListingId={isSectionSelected ? selection.listingId : null}
            selectedSeatIds={isSectionSelected ? selection.seatIds : []}
            onSelectListing={handleSelectListing}
            seatColors={seatColors}
            connectorWidth={connectorWidth}
            externalHoveredListingId={disableHover ? null : (isExternalSectionHover ? hoverState.listingId : null)}
            onListingHover={disableHover ? undefined : handleListingHover}
            hoverTransitionMs={hoverTransitionMs}
            selectedRowId={isSectionSelected ? selection.rowId : null}
            onSelectZoneRow={handleSelectZoneRow}
            onZoneRowHover={disableHover ? undefined : handleZoneRowHover}
            externalHoveredRowId={disableHover ? null : externalHoveredZoneRowId}
            zoneRowDisplay={zoneRowDisplay}
            listingColorOverrides={dealColorOverrides}
          />
        );
    }
  };

  // Compute pin positions and render Pin components
  const renderPins = () => {
    if (pins.length === 0) return null;

    const sectionWidth = getSeatRowWidth(config.seatsPerRow);
    const pinVisibilityContext = {
      displayMode,
      pins,
      sectionId: config.sectionId,
      selectedListing,
      hoverTarget: hoverPinTarget,
    } as const;

    if (displayMode === 'sections') {
      if (!isDensityEnabled(config.sectionId, pinDensity[displayMode])) return null;

      const lowestPriceListing = getLowestPricePin(pins);
      if (!lowestPriceListing) return null;
      if (!isPinVisible(lowestPriceListing, pinVisibilityContext)) return null;

      return (
        <Pin
          price={lowestPriceListing.listing.price}
          dealScore={lowestPriceListing.listing.dealScore}
          x={sectionWidth / 2}
          y={getSectionHeight(config.numRows) * 0.3}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
        />
      );
    }

    if (displayMode === 'rows') {
      const byRow = getLowestPricePinsByRow(pins);

      return byRow.map(([rowIndex, pin]) => {
        if (!isDensityEnabled(pin.listing.rowId, pinDensity[displayMode])) return null;
        if (getPinVisualState(pin, pinVisibilityContext) === 'hidden') return null;

        const { cy } = getSeatCenter(rowIndex, 0);
        return (
          <Pin
            key={pin.listing.listingId}
            price={pin.listing.price}
            dealScore={pin.listing.dealScore}
            x={sectionWidth / 2}
            y={cy}

            defaultColor={seatColors.pinDefault}
            hoverColor={seatColors.pinHovered}
            pressedColor={seatColors.pinPressed}
            selectedColor={seatColors.pinSelected}
          />
        );
      });
    }

    return getDensityPinSlice(pins, pinDensity[displayMode]).map((pin) => {
      if (getPinVisualState(pin, pinVisibilityContext) === 'hidden') return null;

      const { cx: x, cy: y } = getSeatCenter(pin.rowIndex, pin.seatIndex);
      return (
        <Pin
          key={pin.listing.listingId}
          price={pin.listing.price}
          dealScore={pin.listing.dealScore}
          x={x}
          y={y}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
        />
      );
    });
  };

  // Render a hover pin for the currently hovered listing/row/section
  const renderHoverPin = () => {
    if (!hoverPinTarget) return null;

    const sectionWidth = getSeatRowWidth(config.seatsPerRow);
    let x = sectionWidth / 2;
    let y = getSectionHeight(config.numRows) * 0.3;

    if (hoverPinTarget.kind === 'row') {
      const position = getSeatCenter(hoverPinTarget.rowIndex, 0);
      y = position.cy;
    }

    if (hoverPinTarget.kind === 'seat') {
      const position = getSeatCenter(hoverPinTarget.rowIndex, hoverPinTarget.seatIndex);
      x = position.cx;
      y = position.cy - SEAT_SIZE / 2;
    }

    const hoverVisualState = getOverlayPinVisualState({ isSelected: false, isHovered: true });

    return (
      <Pin
        isHovered={hoverVisualState === 'hover'}
        price={hoverPinTarget.listing.price}
        dealScore={hoverPinTarget.listing.dealScore}
        x={x}
        y={y}
        defaultColor={seatColors.pinDefault}
        hoverColor={seatColors.pinHovered}
        pressedColor={seatColors.pinPressed}
        selectedColor={seatColors.pinSelected}
        seatViewUrl={hoverPinTarget.listing.seatViewUrl}
        sectionLabel={hoverPinTarget.listing.sectionLabel}
        rowNumber={hoverPinTarget.listing.rowNumber}
      />
    );
  };

  // Render a selected pin for the currently selected listing
  const renderSelectedPin = () => {
    if (!selectedListing || selectedListing.sectionId !== config.sectionId) return null;
    const sectionWidth = getSeatRowWidth(config.seatsPerRow);

    if (displayMode === 'sections') {
      const selectedVisualState = getOverlayPinVisualState({ isSelected: true, isHovered: true });
      return (
        <Pin
          isSelected={selectedVisualState === 'selected'}
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={sectionWidth / 2}
          y={getSectionHeight(config.numRows) * 0.3}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          seatViewUrl={selectedListing.seatViewUrl}
          sectionLabel={selectedListing.sectionLabel}
          rowNumber={selectedListing.rowNumber}
        />
      );
    }

    const rowIndex = selectedListing.rowNumber - 1;

    if (displayMode === 'rows') {
      // Center selected pin on the row, matching regular row pin position
      const { cy } = getSeatCenter(rowIndex, 0);
      const selectedVisualState = getOverlayPinVisualState({ isSelected: true, isHovered: true });
      return (
        <Pin
          isSelected={selectedVisualState === 'selected'}
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={sectionWidth / 2}
          y={cy}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          seatViewUrl={selectedListing.seatViewUrl}
          sectionLabel={selectedListing.sectionLabel}
          rowNumber={selectedListing.rowNumber}
        />
      );
    }

    // Seats mode: derive position from listing data
    // For zone row listings, position at row center (synthetic seatIds can't be parsed)
    const row = sectionData.rows.find(r => r.rowId === selectedListing.rowId);
    if (row?.isZoneRow) {
      const { cy } = getSeatCenter(rowIndex, 0);
      const selectedVisualState = getOverlayPinVisualState({ isSelected: true, isHovered: true });
      return (
        <Pin
          isSelected={selectedVisualState === 'selected'}
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={sectionWidth / 2}
          y={cy}
          defaultColor={seatColors.pinDefault}
          hoverColor={seatColors.pinHovered}
          pressedColor={seatColors.pinPressed}
          selectedColor={seatColors.pinSelected}
          seatViewUrl={selectedListing.seatViewUrl}
          sectionLabel={selectedListing.sectionLabel}
          rowNumber={selectedListing.rowNumber}
        />
      );
    }

    const middleSeatId = selectedListing.seatIds[Math.floor(selectedListing.seatIds.length / 2)];
    const seatIndex = middleSeatId
      ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1
      : 0;

    const { cx: x, cy } = getSeatCenter(rowIndex, seatIndex);
    const y = cy - SEAT_SIZE / 2;
    const selectedVisualState = getOverlayPinVisualState({ isSelected: true, isHovered: true });

    return (
      <Pin
        isSelected={selectedVisualState === 'selected'}
        price={selectedListing.price}
        dealScore={selectedListing.dealScore}
        x={x}
        y={y}
        defaultColor={seatColors.pinDefault}
        hoverColor={seatColors.pinHovered}
        pressedColor={seatColors.pinPressed}
        selectedColor={seatColors.pinSelected}
        seatViewUrl={selectedListing.seatViewUrl}
        sectionLabel={selectedListing.sectionLabel}
        rowNumber={selectedListing.rowNumber}
      />
    );
  };

  return (
    <div
      id={`section-${config.sectionId}`}
      style={{
        position: 'absolute',
        left: `${config.x}px`,
        top: `${config.y}px`,
        overflow: 'visible',
        zIndex: hoverPinTarget ? 50 : (selectedListing?.sectionId === config.sectionId ? 10 : undefined),
      }}
    >
      {renderContent()}
      {renderPins()}
      {renderSelectedPin()}
      {!disableHover && renderHoverPin()}
    </div>
  );
}
