import { parseSeatId } from './utils';
import type { DisplayMode, HoverState, Listing, PinData } from '../model/types';

export type PinVisualState = 'default' | 'hover' | 'selected' | 'hidden';

export interface PinVisibilityContext {
  displayMode: DisplayMode;
  pins: PinData[];
  sectionId: string;
  selectedListing: Listing | null;
  hoverTarget: HoverPinTarget | null;
}

export type HoverPinTarget =
  | { kind: 'section'; listing: Listing }
  | { kind: 'row'; listing: Listing; rowIndex: number }
  | { kind: 'seat'; listing: Listing; rowIndex: number; seatIndex: number };

export interface HoverPinTargetInput {
  displayMode: DisplayMode;
  hoverState: HoverState;
  sectionId: string;
  sectionListings: Listing[];
  selectedListing: Listing | null;
}

function findCheapestListing(
  listings: Listing[],
  predicate?: (listing: Listing) => boolean,
): Listing | null {
  const filtered = predicate ? listings.filter(predicate) : listings;
  if (filtered.length === 0) return null;
  return filtered.reduce((min, listing) => (listing.price < min.price ? listing : min), filtered[0]);
}

export function getHoverPinTarget({
  displayMode,
  hoverState,
  sectionId,
  sectionListings,
  selectedListing,
}: HoverPinTargetInput): HoverPinTarget | null {
  if (hoverState.sectionId !== sectionId) return null;
  if (sectionListings.length === 0) return null;

  if (displayMode === 'sections') {
    if (hoverState.listingId && selectedListing && hoverState.listingId === selectedListing.listingId) return null;
    if (selectedListing && selectedListing.sectionId === sectionId) return null;

    const cheapest = findCheapestListing(sectionListings);
    if (!cheapest) return null;
    return { kind: 'section', listing: cheapest };
  }

  if (displayMode === 'rows' && hoverState.rowId) {
    if (hoverState.listingId && selectedListing && hoverState.listingId === selectedListing.listingId) return null;

    const cheapestInRow = findCheapestListing(sectionListings, (listing) => listing.rowId === hoverState.rowId);
    if (!cheapestInRow) return null;

    const rowIndex = cheapestInRow.rowNumber - 1;
    if (selectedListing && selectedListing.sectionId === sectionId && selectedListing.rowNumber - 1 === rowIndex) return null;

    return { kind: 'row', listing: cheapestInRow, rowIndex };
  }

  if (displayMode === 'seats' && hoverState.listingId) {
    if (selectedListing && hoverState.listingId === selectedListing.listingId) return null;

    const listing = sectionListings.find((item) => item.listingId === hoverState.listingId);
    if (!listing) return null;

    const rowIndex = listing.rowNumber - 1;
    const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
    const seatIndex = middleSeatId ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1 : 0;

    return { kind: 'seat', listing, rowIndex, seatIndex };
  }

  return null;
}

export function getLowestPricePin(pins: PinData[]): PinData | null {
  if (pins.length === 0) return null;
  return pins.reduce((min, pin) => (pin.listing.price < min.listing.price ? pin : min), pins[0]);
}

export function getLowestPricePinsByRow(pins: PinData[]): Array<[number, PinData]> {
  const byRow = new Map<number, PinData>();
  for (const pin of pins) {
    const existing = byRow.get(pin.rowIndex);
    if (!existing || pin.listing.price < existing.listing.price) {
      byRow.set(pin.rowIndex, pin);
    }
  }
  return Array.from(byRow.entries());
}

export function isPinVisible(pin: PinData, context: PinVisibilityContext): boolean {
  const { displayMode, pins, sectionId, selectedListing, hoverTarget } = context;
  const isSelectedInSection = !!selectedListing && selectedListing.sectionId === sectionId;

  if (displayMode === 'sections') {
    if (isSelectedInSection) return false;
    if (hoverTarget) return false;
    const lowestPricePin = getLowestPricePin(pins);
    return !!lowestPricePin && lowestPricePin.listing.listingId === pin.listing.listingId;
  }

  if (displayMode === 'rows') {
    if (isSelectedInSection && selectedListing.rowNumber - 1 === pin.rowIndex) return false;
    if (hoverTarget?.kind === 'row' && hoverTarget.rowIndex === pin.rowIndex) return false;
    return true;
  }

  if (displayMode === 'seats') {
    if (isSelectedInSection && selectedListing.listingId === pin.listing.listingId) return false;
    if (hoverTarget?.kind === 'seat' && hoverTarget.listing.listingId === pin.listing.listingId) return false;
    return true;
  }

  return true;
}

export function getPinVisualState(pin: PinData, context: PinVisibilityContext): PinVisualState {
  if (!isPinVisible(pin, context)) return 'hidden';
  return 'default';
}

export function getOverlayPinVisualState(params: { isSelected: boolean; isHovered: boolean }): PinVisualState {
  if (params.isSelected) return 'selected';
  if (params.isHovered) return 'hover';
  return 'default';
}
