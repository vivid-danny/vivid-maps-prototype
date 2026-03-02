import type { Listing, SectionConfig, PinData } from '../model/types';
import { createSeededRandom } from './seededRandom';
import { hashString, parseSeatId } from '../behavior/utils';

/**
 * Select pins for a section using multi-pass greedy selection.
 * Pass 1: Chebyshev distance >= 2 from all placed pins (well-spaced)
 * Pass 2: Chebyshev distance >= 1 from all placed pins (adjacent OK)
 * Pass 3: All remaining candidates (overlapping allowed at high density)
 * Returns priority-ordered PinData[] with no hard cap.
 */
function selectPinsForSection(
  listings: Listing[],
  sectionConfig: SectionConfig,
  seed: number
): PinData[] {
  if (listings.length === 0) return [];

  const rng = createSeededRandom(seed);

  // Build candidates: one per listing with its representative seat position
  const candidates: PinData[] = [];
  for (const listing of listings) {
    const rowIndex = listing.rowNumber - 1;

    // Unmapped listings (zone rows): use row center as pin position
    if (listing.isUnmapped) {
      const seatIndex = Math.floor(sectionConfig.seatsPerRow / 2);
      candidates.push({ listing, rowIndex, seatIndex });
      continue;
    }

    const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
    const parsed = parseSeatId(middleSeatId);
    if (!parsed) continue;
    const seatIndex = parsed.seatNumber - 1;

    candidates.push({ listing, rowIndex, seatIndex });
  }

  // Identify zone row indices: any row that has an isUnmapped candidate
  const zoneRowIndices = new Set<number>();
  for (const c of candidates) {
    if (c.listing.isUnmapped) zoneRowIndices.add(c.rowIndex);
  }

  // Collapse zone row candidates to one per row (keep cheapest)
  const zoneRowBest = new Map<number, PinData>();
  const nonZone: PinData[] = [];
  for (const c of candidates) {
    if (zoneRowIndices.has(c.rowIndex)) {
      const existing = zoneRowBest.get(c.rowIndex);
      if (!existing || c.listing.price < existing.listing.price) {
        zoneRowBest.set(c.rowIndex, c);
      }
    } else {
      nonZone.push(c);
    }
  }
  const deduped = [...nonZone, ...zoneRowBest.values()];

  // Shuffle candidates deterministically
  rng.shuffle(deduped);

  const chebyshev = (a: PinData, b: PinData) =>
    Math.max(Math.abs(a.rowIndex - b.rowIndex), Math.abs(a.seatIndex - b.seatIndex));

  const selected: PinData[] = [];
  const remaining: PinData[] = [...deduped];

  // Pass 1: Chebyshev >= 2
  const afterPass1: PinData[] = [];
  for (const candidate of remaining) {
    const tooClose = selected.some((pin) => chebyshev(pin, candidate) < 2);
    if (!tooClose) {
      selected.push(candidate);
    } else {
      afterPass1.push(candidate);
    }
  }

  // Pass 2: Chebyshev >= 1 from all placed
  const afterPass2: PinData[] = [];
  for (const candidate of afterPass1) {
    const tooClose = selected.some((pin) => chebyshev(pin, candidate) < 1);
    if (!tooClose) {
      selected.push(candidate);
    } else {
      afterPass2.push(candidate);
    }
  }

  // Pass 3: all remaining (overlapping allowed)
  for (const candidate of afterPass2) {
    selected.push(candidate);
  }

  return selected;
}

/**
 * Generate pin assignments for all sections.
 * Returns a Map from sectionId to an array of PinData.
 */
export function generateAllPins(
  allListings: Listing[],
  sections: SectionConfig[],
  mapSeed: number
): Map<string, PinData[]> {
  const pinsBySection = new Map<string, PinData[]>();

  // Group listings by sectionId
  const listingsBySection = new Map<string, Listing[]>();
  for (const listing of allListings) {
    const existing = listingsBySection.get(listing.sectionId) || [];
    existing.push(listing);
    listingsBySection.set(listing.sectionId, existing);
  }

  for (const sectionConfig of sections) {
    const sectionListings = listingsBySection.get(sectionConfig.sectionId) || [];
    const seed = hashString(`${mapSeed}-pins-${sectionConfig.sectionId}`);
    const pins = selectPinsForSection(sectionListings, sectionConfig, seed);
    if (pins.length > 0) {
      pinsBySection.set(sectionConfig.sectionId, pins);
    }
  }

  return pinsBySection;
}
