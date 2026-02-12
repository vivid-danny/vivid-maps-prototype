import type { Listing, SectionConfig, PinData } from '../model/types';
import { createSeededRandom } from './seededRandom';
import { hashString, parseSeatId } from '../domain/utils';

/**
 * Select up to 3 pins for a section using greedy selection with Chebyshev distance >= 2.
 * Pins are placed at specific seat positions and carry listing price info.
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
    const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
    const parsed = parseSeatId(middleSeatId);
    if (!parsed) continue;
    const seatIndex = parsed.seatNumber - 1;

    candidates.push({ listing, rowIndex, seatIndex });
  }

  // Shuffle candidates deterministically
  rng.shuffle(candidates);

  // Greedy selection with Chebyshev distance >= 2
  const selected: PinData[] = [];
  for (const candidate of candidates) {
    if (selected.length >= 3) break;

    const tooClose = selected.some(
      (pin) =>
        Math.abs(pin.rowIndex - candidate.rowIndex) <= 1 &&
        Math.abs(pin.seatIndex - candidate.seatIndex) <= 1
    );

    if (!tooClose) {
      selected.push(candidate);
    }
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
