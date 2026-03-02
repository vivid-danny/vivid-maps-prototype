import type { SectionConfig, SectionData, SeatData } from '../model/types';
import { createSeededRandom, SeededRandom } from './seededRandom';
import { hashString, parseSeatIdNums } from '../behavior/utils';

// Generate section data from config using seeded randomization
export function generateSectionData(
  config: SectionConfig,
  seed: number
): SectionData {
  // Create a unique seed for this section by combining map seed with section id
  const sectionSeed = hashString(`${seed}-${config.sectionId}`);
  const rng = createSeededRandom(sectionSeed);

  const { sectionId, numRows, seatsPerRow, soldOutRows } = config;
  const unavailableRatio = config.unavailableRatio ?? 0.1;
  const listingCount = config.listingCount ?? 5;
  const seatsPerListing = config.seatsPerListing ?? [2, 4];

  // Convert soldOutRows and seatSaverRows to Sets for quick lookup (1-indexed)
  const soldOutRowSet = new Set(soldOutRows ?? []);
  const seatSaverRowSet = new Set(config.seatSaverRows ?? []);

  // Generate all seat IDs
  const allSeatIds: string[] = [];
  for (let r = 0; r < numRows; r++) {
    for (let s = 0; s < seatsPerRow; s++) {
      allSeatIds.push(`${sectionId}${r + 1}-${s + 1}`);
    }
  }

  // Handle fully sold out sections (unavailableRatio >= 1.0)
  if (unavailableRatio >= 1.0) {
    const rows = Array.from({ length: numRows }, (_, rowIndex) => ({
      rowId: `${sectionId}${rowIndex + 1}`,
      seats: Array.from({ length: seatsPerRow }, (_, seatIndex) => ({
        seatId: `${sectionId}${rowIndex + 1}-${seatIndex + 1}`,
        status: 'unavailable' as const,
        listingId: undefined,
      })),
    }));
    return { sectionId, rows };
  }

  // Determine unavailable seats (excluding sold out rows and saver rows which are handled separately)
  const seatsNotInSpecialRows = allSeatIds.filter((id) => {
    const parsed = parseSeatIdNums(id);
    if (!parsed) return true;
    return !soldOutRowSet.has(parsed.rowNum) && !seatSaverRowSet.has(parsed.rowNum);
  });

  const unavailableCount = Math.floor(seatsNotInSpecialRows.length * unavailableRatio);
  const unavailableSeats = new Set(rng.pick(seatsNotInSpecialRows, unavailableCount));

  // Add all seats from sold out rows to unavailable set
  allSeatIds.forEach((id) => {
    const parsed = parseSeatIdNums(id);
    if (parsed && soldOutRowSet.has(parsed.rowNum)) {
      unavailableSeats.add(id);
    }
  });

  // Generate listings for available seats, excluding saver rows (pre-assigned below)
  const availableSeatIds = allSeatIds.filter((id) => !unavailableSeats.has(id));
  const availableSeatIdsForListings = availableSeatIds.filter((id) => {
    const parsed = parseSeatIdNums(id);
    return !parsed || !seatSaverRowSet.has(parsed.rowNum);
  });
  const seatListings = generateListings(
    availableSeatIdsForListings,
    listingCount,
    seatsPerListing,
    sectionId,
    numRows,
    seatsPerRow,
    rng
  );

  // Build section data
  const rows = Array.from({ length: numRows }, (_, rowIndex) => ({
    rowId: `${sectionId}${rowIndex + 1}`,
    seats: Array.from({ length: seatsPerRow }, (_, seatIndex) => {
      const seatId = `${sectionId}${rowIndex + 1}-${seatIndex + 1}`;
      const isUnavailable = unavailableSeats.has(seatId);

      // All available seats get a listingId
      // - Saver row seats: pre-assigned full-row listing id
      // - Grouped seats: use listingId from seatListings
      // - Solo seats: assign solo-{sectionId}-{seatId}
      let listingId: string | undefined;
      if (!isUnavailable) {
        const parsed = parseSeatIdNums(seatId);
        if (parsed && seatSaverRowSet.has(parsed.rowNum)) {
          listingId = `listing-${sectionId}-saver-${parsed.rowNum}`;
        } else {
          listingId = seatListings.get(seatId) || `solo-${sectionId}-${seatId}`;
        }
      }

      return {
        seatId,
        status: isUnavailable ? ('unavailable' as const) : ('available' as const),
        listingId,
      };
    }),
  }));

  return { sectionId, rows };
}

// Generate listings by greedily grouping consecutive available seats within each row.
// Runs shorter than seatsPerListing[0] stay ungrouped (become solo listings).
function generateListings(
  availableSeatIds: string[],
  _listingCount: number,
  seatsPerListing: [number, number],
  sectionId: string,
  _numRows: number,
  _seatsPerRow: number,
  rng: SeededRandom
): Map<string, string> {
  const listings = new Map<string, string>();

  // Bucket available seats by row number
  const seatsByRow = new Map<number, number[]>();
  for (const id of availableSeatIds) {
    const parsed = parseSeatIdNums(id);
    if (!parsed) continue;
    if (!seatsByRow.has(parsed.rowNum)) seatsByRow.set(parsed.rowNum, []);
    seatsByRow.get(parsed.rowNum)!.push(parsed.seatNum);
  }

  let listingIndex = 1;

  for (const [rowNum, seatNums] of seatsByRow) {
    seatNums.sort((a, b) => a - b);

    let i = 0;
    while (i < seatNums.length) {
      // Find the end of the consecutive run starting at i
      let runEnd = i;
      while (runEnd + 1 < seatNums.length && seatNums[runEnd + 1] === seatNums[runEnd] + 1) {
        runEnd++;
      }

      // Greedily fill [i..runEnd] with groups
      let pos = i;
      while (pos <= runEnd) {
        const remaining = runEnd - pos + 1;
        if (remaining < seatsPerListing[0]) break; // too short; leave as solo
        const maxSize = Math.min(seatsPerListing[1], remaining);
        const groupSize = rng.randInt(seatsPerListing[0], maxSize + 1);
        const listingId = `listing-${sectionId}-${listingIndex++}`;
        for (let k = 0; k < groupSize; k++) {
          listings.set(`${sectionId}${rowNum}-${seatNums[pos + k]}`, listingId);
        }
        pos += groupSize;
      }

      i = runEnd + 1;
    }
  }

  return listings;
}
