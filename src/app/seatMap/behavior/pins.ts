import { hashString, parseSeatId } from './utils';
import type { DisplayMode, HoverState, Listing, PinData } from '../model/types';

const DEFAULT_MIN_DEAL_SCORE = 5.0;

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

// Calibrated for the real venue's synthetic lng/lat space (~0.098 × 0.072).
// At sections density 0.15, minDistance = 0.0015 / 0.15 = 0.010 → ~15–20 sections shown.
export const MAPLIBRE_DECLUTTER_BASE_DISTANCE: Record<DisplayMode, number> = {
  sections: 0.0015,
  // Row centers are materially tighter than section centers when zoomed out, so
  // rows need a comparable venue-space collision radius to avoid visible bunching.
  rows: 0.0015,
  seats: 0.00018,
};

export function declutterPins<T extends ResolvedPin>(
  resolvedPins: T[],
  displayMode: DisplayMode,
  density: number,
  isMobile = false,
  baseDistance: Record<DisplayMode, number> = DECLUTTER_BASE_DISTANCE,
): T[] {
  if (density <= 0 || resolvedPins.length === 0) return [];

  const base = baseDistance[displayMode] * (isMobile ? MOBILE_DECLUTTER_MULTIPLIER[displayMode] : 1);
  const minDistance = base / density;

  // Sort by deal score so seed is the best deal and ties break by deal quality
  const sorted = [...resolvedPins].sort((a, b) => {
    const scoreDiff = b.pin.listing.dealScore - a.pin.listing.dealScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.pin.listing.price - b.pin.listing.price;
  });

  // Seed with the best deal, then use farthest-first insertion to maximize coverage
  const placed: T[] = [sorted[0]];
  const remaining = new Set(sorted.slice(1));

  while (remaining.size > 0) {
    let bestCandidate: T | null = null;
    let bestMinDist = -1;

    for (const candidate of remaining) {
      let nearestDist = Infinity;
      for (const p of placed) {
        const dx = p.x - candidate.x;
        const dy = p.y - candidate.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) nearestDist = dist;
      }

      // Prune candidates that will never pass the minimum distance
      if (nearestDist < minDistance) {
        remaining.delete(candidate);
        continue;
      }

      // Pick farthest from all placed pins; break ties by deal score
      if (nearestDist > bestMinDist ||
          (nearestDist === bestMinDist && bestCandidate &&
           candidate.pin.listing.dealScore > bestCandidate.pin.listing.dealScore)) {
        bestCandidate = candidate;
        bestMinDist = nearestDist;
      }
    }

    if (!bestCandidate) break;
    placed.push(bestCandidate);
    remaining.delete(bestCandidate);
  }

  return placed;
}

export function splitSeatModePins<T extends ResolvedPin>(
  resolvedPins: T[],
  selectedSectionId: string | null,
  backgroundDensity: number,
  isMobile = false,
  baseDistance: Record<DisplayMode, number> = DECLUTTER_BASE_DISTANCE,
): T[] {
  if (resolvedPins.length === 0) return [];
  if (!selectedSectionId) {
    return declutterPins(resolvedPins, 'seats', backgroundDensity, isMobile, baseDistance);
  }

  const activeSectionPins = resolvedPins.filter((pin) => pin.sectionId === selectedSectionId);
  const backgroundPins = resolvedPins.filter((pin) => pin.sectionId !== selectedSectionId);
  const declutteredBackgroundPins = declutterPins(
    backgroundPins,
    'seats',
    backgroundDensity,
    isMobile,
    baseDistance,
  );

  return [...declutteredBackgroundPins, ...activeSectionPins];
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

    const rowIndex = (cheapestInRow.rowNumber ?? 1) - 1;
    if (
      selectedListing
      && selectedListing.sectionId === sectionId
      && selectedListing.rowNumber !== null
      && selectedListing.rowNumber - 1 === rowIndex
    ) return null;

    return { kind: 'row', listing: cheapestInRow, rowIndex };
  }

  if (displayMode === 'seats' && hoverState.listingId) {
    if (selectedListing && hoverState.listingId === selectedListing.listingId) return null;

    const listing = sectionListings.find((item) => item.listingId === hoverState.listingId);
    if (!listing) return null;

    const rowIndex = (listing.rowNumber ?? 1) - 1;

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

export function getBestDealPin(pins: PinData[]): PinData | null {
  if (pins.length === 0) return null;
  return pins.reduce((best, pin) => {
    const scoreDiff = pin.listing.dealScore - best.listing.dealScore;
    if (scoreDiff !== 0) return scoreDiff > 0 ? pin : best;
    return pin.listing.price < best.listing.price ? pin : best;
  }, pins[0]);
}

function pickBestDealByScoreAndPrice<T extends { dealScore: number; price: number }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, item) => {
    const scoreDiff = item.dealScore - best.dealScore;
    if (scoreDiff !== 0) return scoreDiff > 0 ? item : best;
    return item.price < best.price ? item : best;
  }, items[0]);
}

export function getBestDealListingWithMinScoreFallback(
  listings: Listing[],
  minDealScore = DEFAULT_MIN_DEAL_SCORE,
): Listing | null {
  const qualifying = listings.filter((listing) => listing.dealScore >= minDealScore);
  return pickBestDealByScoreAndPrice(qualifying) ?? pickBestDealByScoreAndPrice(listings);
}

export function getBestDealPinWithMinScoreFallback(
  pins: PinData[],
  minDealScore = DEFAULT_MIN_DEAL_SCORE,
): PinData | null {
  const qualifying = pins.filter((pin) => pin.listing.dealScore >= minDealScore);
  return getBestDealPin(qualifying) ?? getBestDealPin(pins);
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
    if (isSelectedInSection && selectedListing.rowNumber !== null && selectedListing.rowNumber - 1 === pin.rowIndex) return false;
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
