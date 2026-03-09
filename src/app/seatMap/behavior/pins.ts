import { hashString, parseSeatId } from './utils';
import type { DisplayMode, HoverState, Listing, PinData } from '../model/types';

export interface ResolvedPin {
  pin: PinData;
  x: number;
  y: number;
  sectionId: string;
}

// Base distances calibrated to desktop initial scale (0.12).
// At default densities: sections → ~333 units (40px), rows → ~100 units (30px), seats → ~50 units (25px).
const DECLUTTER_BASE_DISTANCE: Record<DisplayMode, number> = {
  sections: 100,
  rows: 20,
  seats: 5,
};

// Mobile initial scale (0.03) is 4x more zoomed out than desktop (0.12), so
// pins need proportionally larger venue-unit separation to avoid overlapping on screen.
const MOBILE_DECLUTTER_MULTIPLIER: Record<DisplayMode, number> = {
  sections: 3,
  rows: 2,
  seats: 1.5,
};

export function declutterPins<T extends ResolvedPin>(
  resolvedPins: T[],
  displayMode: DisplayMode,
  density: number,
  isMobile = false,
): T[] {
  if (density <= 0) return [];

  const base = DECLUTTER_BASE_DISTANCE[displayMode] * (isMobile ? MOBILE_DECLUTTER_MULTIPLIER[displayMode] : 1);
  const minDistance = base / density;

  const sorted = [...resolvedPins].sort((a, b) => {
    const scoreDiff = b.pin.listing.dealScore - a.pin.listing.dealScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.pin.listing.price - b.pin.listing.price;
  });

  const placed: T[] = [];
  for (const candidate of sorted) {
    const tooClose = placed.some((p) => {
      const dx = p.x - candidate.x;
      const dy = p.y - candidate.y;
      return Math.sqrt(dx * dx + dy * dy) < minDistance;
    });
    if (!tooClose) placed.push(candidate);
  }
  return placed;
}

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

    // Unmapped listings (zone rows): position at row center
    if (listing.isUnmapped) {
      return { kind: 'row', listing, rowIndex };
    }

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

// Deterministic per-id check for sections/rows mode density filtering.
// Uses Fibonacci/Knuth multiplicative hashing to ensure good distribution even
// for short sequential IDs (e.g. single-letter section IDs A-H whose raw hash
// values all cluster in the 65-72 range, making a naive % 100 useless).
export function isDensityEnabled(id: string, density: number): boolean {
  const threshold = Math.round(density * 100);
  const hash = (hashString(id) * 2654435761) >>> 0;
  return hash % 100 < threshold;
}

// Slice for seats mode (by count ratio)
export function getDensityPinSlice(pins: PinData[], density: number): PinData[] {
  return pins.slice(0, Math.ceil(pins.length * density));
}
