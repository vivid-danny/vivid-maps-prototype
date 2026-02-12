import type { SectionConfig, SectionData, SeatData } from '../model/types';
import { createSeededRandom, SeededRandom } from './seededRandom';
import { hashString, parseSeatIdNums } from '../domain/utils';

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

  // Convert soldOutRows to a Set for quick lookup (1-indexed)
  const soldOutRowSet = new Set(soldOutRows ?? []);

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

  // Determine unavailable seats (excluding sold out rows which are handled separately)
  const seatsNotInSoldOutRows = allSeatIds.filter((id) => {
    const parsed = parseSeatIdNums(id);
    if (!parsed) return true;
    return !soldOutRowSet.has(parsed.rowNum);
  });

  const unavailableCount = Math.floor(seatsNotInSoldOutRows.length * unavailableRatio);
  const unavailableSeats = new Set(rng.pick(seatsNotInSoldOutRows, unavailableCount));

  // Add all seats from sold out rows to unavailable set
  allSeatIds.forEach((id) => {
    const parsed = parseSeatIdNums(id);
    if (parsed && soldOutRowSet.has(parsed.rowNum)) {
      unavailableSeats.add(id);
    }
  });

  // Generate listings for available seats
  const availableSeatIds = allSeatIds.filter((id) => !unavailableSeats.has(id));
  const seatListings = generateListings(
    availableSeatIds,
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
      // - Grouped seats: use listingId from seatListings
      // - Solo seats: assign solo-{sectionId}-{seatId}
      let listingId: string | undefined;
      if (!isUnavailable) {
        listingId = seatListings.get(seatId) || `solo-${sectionId}-${seatId}`;
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

// Generate listings that group adjacent seats
function generateListings(
  availableSeatIds: string[],
  listingCount: number,
  seatsPerListing: [number, number],
  sectionId: string,
  numRows: number,
  seatsPerRow: number,
  rng: SeededRandom
): Map<string, string> {
  const listings = new Map<string, string>();
  const usedSeats = new Set<string>();

  // Try to create listings by finding adjacent available seats
  for (let i = 0; i < listingCount; i++) {
    const listingId = `listing-${sectionId}-${i + 1}`;
    const groupSize = rng.randInt(seatsPerListing[0], seatsPerListing[1] + 1);

    // Pick a random starting seat from available seats
    const candidateSeats = availableSeatIds.filter((id) => !usedSeats.has(id));
    if (candidateSeats.length === 0) break;

    const startSeatId = candidateSeats[rng.randInt(0, candidateSeats.length)];
    const startPos = parseSeatIdNums(startSeatId);
    if (!startPos) continue;

    // Try to extend horizontally to form a group
    const groupSeats: string[] = [startSeatId];

    // Try extending to the right
    for (let offset = 1; offset < groupSize; offset++) {
      const nextSeat = startPos.seatNum + offset;
      if (nextSeat > seatsPerRow) break;

      const nextSeatId = `${sectionId}${startPos.rowNum}-${nextSeat}`;
      if (availableSeatIds.includes(nextSeatId) && !usedSeats.has(nextSeatId)) {
        groupSeats.push(nextSeatId);
      } else {
        break;
      }
    }

    // If we couldn't get enough seats going right, try extending left
    if (groupSeats.length < groupSize) {
      for (let offset = 1; offset < groupSize - groupSeats.length + 1; offset++) {
        const prevSeat = startPos.seatNum - offset;
        if (prevSeat < 1) break;

        const prevSeatId = `${sectionId}${startPos.rowNum}-${prevSeat}`;
        if (availableSeatIds.includes(prevSeatId) && !usedSeats.has(prevSeatId)) {
          groupSeats.unshift(prevSeatId);
        } else {
          break;
        }
      }
    }

    // Only create listing if we got at least 2 seats
    if (groupSeats.length >= 2) {
      groupSeats.forEach((seatId) => {
        listings.set(seatId, listingId);
        usedSeats.add(seatId);
      });
    }
  }

  return listings;
}

