import { useMemo } from 'react';
import { SeatsView } from './SeatsView';
import { RowsView } from './RowsView';
import { SectionView } from './SectionView';
import { Pin } from './Pin';
import { SEAT_SIZE, getSeatRowWidth, getSeatCenter, getSectionHeight } from './constants';
import { parseSeatId } from '../seatMap/domain/utils';
import type { SectionConfig, SectionData, SeatColors, DisplayMode, SelectionState, HoverState, PinData, Listing } from '../seatMap/model/types';

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
  currentScale?: number;
  selectedListing?: Listing | null;
  sectionListings?: Listing[];
  disableHover?: boolean;
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
  currentScale = 1,
  selectedListing = null,
  sectionListings = [],
  disableHover = false,
}: SectionProps) {
  // Handle section selection (only sets sectionId)
  const handleSelectSection = (sectionId: string) => {
    onSelect({
      sectionId,
      rowId: null,
      listingId: null,
      seatIds: [],
    });
  };

  // Handle row selection (sets sectionId and rowId)
  const handleSelectRow = (rowId: string) => {
    onSelect({
      sectionId: config.sectionId,
      rowId,
      listingId: null,
      seatIds: [],
    });
  };

  // Handle seat/listing selection (sets all levels)
  const handleSelectListing = (listingId: string, seatIds: string[]) => {
    const rowId = seatIds.length > 0 ? (parseSeatId(seatIds[0])?.rowId ?? null) : null;

    onSelect({
      sectionId: config.sectionId,
      rowId,
      listingId,
      seatIds,
    });
  };

  // Check if this section is selected (at any level)
  const isSectionSelected = selection.sectionId === config.sectionId;

  // Hover handlers for each display mode
  const handleSectionHover = (hovered: boolean) => {
    if (hovered) {
      onHover({
        listingId: null,
        sectionId: config.sectionId,
        rowId: null,
      });
    } else {
      onHover({
        listingId: null,
        sectionId: null,
        rowId: null,
      });
    }
  };

  const handleRowHover = (rowId: string | null) => {
    if (rowId) {
      onHover({
        listingId: null,
        sectionId: config.sectionId,
        rowId,
      });
    } else {
      onHover({
        listingId: null,
        sectionId: null,
        rowId: null,
      });
    }
  };

  const handleListingHover = (listingId: string | null) => {
    if (listingId) {
      onHover({
        listingId,
        sectionId: config.sectionId,
        rowId: null, // Will be derived from listing if needed
      });
    } else {
      onHover({
        listingId: null,
        sectionId: null,
        rowId: null,
      });
    }
  };

  // Check external hover state for this section
  const isExternalSectionHover = hoverState.sectionId === config.sectionId;

  // Find the cheapest listing from a set, optionally filtered by predicate
  const findCheapestListing = (
    listings: Listing[],
    predicate?: (l: Listing) => boolean
  ): Listing | null => {
    const filtered = predicate ? listings.filter(predicate) : listings;
    if (filtered.length === 0) return null;
    return filtered.reduce((min, l) => (l.price < min.price ? l : min), filtered[0]);
  };

  // Compute hover pin data based on current hover state and display mode
  const hoverPinData = useMemo(() => {
    const isHoveringThisSection = hoverState.sectionId === config.sectionId;
    if (!isHoveringThisSection) return null;
    if (sectionListings.length === 0) return null;

    const sectionWidth = getSeatRowWidth(config.seatsPerRow);

    if (displayMode === 'sections') {
      // Skip if hovering the selected listing
      if (hoverState.listingId && selectedListing && hoverState.listingId === selectedListing.listingId) return null;
      // Skip if selected pin already occupies this section position
      if (selectedListing && selectedListing.sectionId === config.sectionId) return null;

      const cheapest = findCheapestListing(sectionListings);
      if (!cheapest) return null;
      return { price: cheapest.price, dealScore: cheapest.dealScore, x: sectionWidth / 2, y: getSectionHeight(config.numRows) * 0.3, seatViewUrl: cheapest.seatViewUrl, sectionLabel: cheapest.sectionLabel, rowNumber: cheapest.rowNumber };
    }

    if (displayMode === 'rows' && hoverState.rowId) {
      // Skip if hovering the selected listing
      if (hoverState.listingId && selectedListing && hoverState.listingId === selectedListing.listingId) return null;

      const cheapestInRow = findCheapestListing(sectionListings, l => l.rowId === hoverState.rowId);
      if (!cheapestInRow) return null;

      const rowIndex = cheapestInRow.rowNumber - 1;
      // Skip if selected pin already occupies this row
      if (selectedListing && selectedListing.sectionId === config.sectionId && selectedListing.rowNumber - 1 === rowIndex) return null;

      const { cy } = getSeatCenter(rowIndex, 0);
      return { price: cheapestInRow.price, dealScore: cheapestInRow.dealScore, x: sectionWidth / 2, y: cy, rowIndex, seatViewUrl: cheapestInRow.seatViewUrl, sectionLabel: cheapestInRow.sectionLabel, rowNumber: cheapestInRow.rowNumber };
    }

    if (displayMode === 'seats' && hoverState.listingId) {
      // Skip if hovering the selected listing
      if (selectedListing && hoverState.listingId === selectedListing.listingId) return null;

      const listing = sectionListings.find(l => l.listingId === hoverState.listingId);
      if (!listing) return null;

      const rowIndex = listing.rowNumber - 1;
      const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
      const seatIndex = middleSeatId ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1 : 0;
      const { cx, cy } = getSeatCenter(rowIndex, seatIndex);
      return { price: listing.price, dealScore: listing.dealScore, x: cx, y: cy - SEAT_SIZE / 2, listingId: listing.listingId, seatViewUrl: listing.seatViewUrl, sectionLabel: listing.sectionLabel, rowNumber: listing.rowNumber };
    }

    return null;
  }, [hoverState, displayMode, config.sectionId, config.seatsPerRow, config.numRows, sectionListings, selectedListing]);

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
          />
        );
    }
  };

  // Compute pin positions and render Pin components
  const renderPins = () => {
    if (pins.length === 0 || currentScale === 0) return null;

    const sectionWidth = getSeatRowWidth(config.seatsPerRow);
    const isSelectedInSection = selectedListing && selectedListing.sectionId === config.sectionId;

    if (displayMode === 'sections') {
      // Hide regular pin when selected or hover pin replaces it
      if (isSelectedInSection) return null;
      if (hoverPinData) return null;

      // Sections mode: 1 centered pin with lowest price
      const lowestPriceListing = pins.reduce(
        (min, pin) => (pin.listing.price < min.listing.price ? pin : min),
        pins[0]
      );
      return (
        <Pin
          price={lowestPriceListing.listing.price}
          dealScore={lowestPriceListing.listing.dealScore}
          x={sectionWidth / 2}
          y={getSectionHeight(config.numRows) * 0.3}
          currentScale={currentScale}
        />
      );
    }

    if (displayMode === 'rows') {
      // Group pins by rowIndex, pick lowest price per row
      const byRow = new Map<number, PinData>();
      for (const pin of pins) {
        const existing = byRow.get(pin.rowIndex);
        if (!existing || pin.listing.price < existing.listing.price) {
          byRow.set(pin.rowIndex, pin);
        }
      }

      const selectedRowIndex = isSelectedInSection
        ? selectedListing.rowNumber - 1
        : null;

      const hoverRowIndex = hoverPinData?.rowIndex;

      return Array.from(byRow.entries()).map(([rowIndex, pin]) => {
        // Hide pin in the row that has a selected listing
        if (rowIndex === selectedRowIndex) return null;
        // Hide pin in the row that has a hover pin
        if (hoverRowIndex !== undefined && rowIndex === hoverRowIndex) return null;

        const { cy } = getSeatCenter(rowIndex, 0);
        return (
          <Pin
            key={pin.listing.listingId}
            price={pin.listing.price}
            dealScore={pin.listing.dealScore}
            x={sectionWidth / 2}
            y={cy}
            currentScale={currentScale}
          />
        );
      });
    }

    // Seats mode: render all pins at their seat positions
    const hoverListingId = hoverPinData?.listingId;

    return pins.map((pin) => {
      // Hide pin that overlaps with the selected pin
      if (isSelectedInSection && pin.listing.listingId === selectedListing.listingId) return null;
      // Hide pin that overlaps with the hover pin
      if (hoverListingId && pin.listing.listingId === hoverListingId) return null;

      const { cx: x, cy: y } = getSeatCenter(pin.rowIndex, pin.seatIndex);
      return (
        <Pin
          key={pin.listing.listingId}
          price={pin.listing.price}
          dealScore={pin.listing.dealScore}
          x={x}
          y={y}
          currentScale={currentScale}
        />
      );
    });
  };

  // Render a hover pin for the currently hovered listing/row/section
  const renderHoverPin = () => {
    if (!hoverPinData || currentScale === 0) return null;
    return (
      <Pin
        isHovered
        hoverColor={seatColors.hover}
        price={hoverPinData.price}
        dealScore={hoverPinData.dealScore}
        x={hoverPinData.x}
        y={hoverPinData.y}
        currentScale={currentScale}
        seatViewUrl={hoverPinData.seatViewUrl}
        sectionLabel={hoverPinData.sectionLabel}
        rowNumber={hoverPinData.rowNumber}
      />
    );
  };

  // Render a selected pin for the currently selected listing
  const renderSelectedPin = () => {
    if (!selectedListing || selectedListing.sectionId !== config.sectionId) return null;
    if (currentScale === 0) return null;

    const sectionWidth = getSeatRowWidth(config.seatsPerRow);

    if (displayMode === 'sections') {
      return (
        <Pin
          isSelected
          selectedColor={seatColors.selected}
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={sectionWidth / 2}
          y={getSectionHeight(config.numRows) * 0.3}
          currentScale={currentScale}
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
      return (
        <Pin
          isSelected
          selectedColor={seatColors.selected}
          price={selectedListing.price}
          dealScore={selectedListing.dealScore}
          x={sectionWidth / 2}
          y={cy}
          currentScale={currentScale}
          seatViewUrl={selectedListing.seatViewUrl}
          sectionLabel={selectedListing.sectionLabel}
          rowNumber={selectedListing.rowNumber}
        />
      );
    }

    // Seats mode: derive position from listing data
    const middleSeatId = selectedListing.seatIds[Math.floor(selectedListing.seatIds.length / 2)];
    const seatIndex = middleSeatId
      ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1
      : 0;

    const { cx: x, cy } = getSeatCenter(rowIndex, seatIndex);
    const y = cy - SEAT_SIZE / 2;

    return (
      <Pin
        isSelected
        selectedColor={seatColors.selected}
        price={selectedListing.price}
        dealScore={selectedListing.dealScore}
        x={x}
        y={y}
        currentScale={currentScale}
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
      }}
    >
      {renderContent()}
      {renderPins()}
      {!disableHover && renderHoverPin()}
      {renderSelectedPin()}
    </div>
  );
}
