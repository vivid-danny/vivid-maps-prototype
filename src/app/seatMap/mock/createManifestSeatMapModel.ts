import seatCountsRaw from './venueSeatCounts.json';
import { createSeededRandom } from './seededRandom';
import { hashString } from '../behavior/utils';
import seatViewImg from '../../../assets/seatView.png';
import type {
  SeatMapModel,
  SectionConfig,
  SectionData,
  SeatData,
  RowData,
  Listing,
  PinData,
  Perk,
  DeliveryInfo,
  EventInfo,
  MapConfig,
} from '../model/types';

const seatCounts = seatCountsRaw as Record<string, Record<string, number>>;

const SEED = 54321;

const DELIVERY_OPTIONS: DeliveryInfo[] = [
  {
    method: 'mobile_transfer',
    label: 'Mobile Transfer',
    description: "When your tickets are ready, we'll send them to the email address on your account.",
  },
  {
    method: 'instant_download',
    label: 'Instant Download',
    description: 'Your tickets will be available for immediate download after purchase.',
  },
];

const VENUE_EVENT_INFO: EventInfo = {
  eventName: 'Baltimore Orioles vs. New York Yankees',
  eventDate: 'Sat, Jul 5, 2025 at 4:05pm',
  venueName: 'Oriole Park at Camden Yards',
  venueAddress: '333 W Camden St, Baltimore, MD 21201',
};

// Zone assignment: Camden Yards sections mapped to match production zone colors
function getZoneName(sectionId: string): string {
  const num = parseInt(sectionId, 10);
  if (isNaN(num)) {
    const lower = sectionId.toLowerCase();
    if (/vip|suite|premium|club/.test(lower)) return 'tier-1-primary';
    if (/field|floor|pit/.test(lower)) return 'tier-2-primary';
    if (/mezzanine|loge|terrace/.test(lower)) return 'tier-3-primary';
    if (/upper|bleacher|nosebleed/.test(lower)) return 'tier-5-primary';
    if (/general|ga|standing/.test(lower)) return 'alt-mid';
    const tier = (hashString(sectionId) % 5) + 1;
    return `tier-${tier}-primary`;
  }

  const subTiers = ['primary', 'secondary', 'tertiary'] as const;
  const sub = subTiers[num % 3]!;

  if (num >= 1 && num <= 98) return `tier-1-${sub}`;       // lower bowl (pink)
  if (num >= 200 && num <= 299) return `tier-2-${sub}`;   // club level (green)
  if (num >= 300 && num <= 400) return `tier-3-${sub}`;   // upper deck (blue)
  return 'alt-far';
}

function getPriceRange(sectionId: string): [number, number] {
  const num = parseInt(sectionId, 10);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 99) return [8000, 25000];     // lower bowl: $80–$250
    if (num >= 200 && num <= 299) return [4000, 15000];   // club level: $40–$150
  }
  return [2000, 8000]; // upper deck and other: $20–$80
}

// Deterministically select N section IDs from an array using a seeded hash
function pickSeatSaverSections(sectionIds: string[], count: number): Set<string> {
  const result = new Set<string>();
  const pool = [...sectionIds];
  let seed = hashString(`${SEED}-saver`);
  while (result.size < count && pool.length > 0) {
    seed = hashString(`${seed}`);
    const idx = Math.abs(seed) % pool.length;
    result.add(pool[idx]!);
    pool.splice(idx, 1);
  }
  return result;
}

interface RowInventory {
  sectionData: SectionData;
  unmappedListingIds: Set<string>;
}

function buildSectionInventory(
  sectionId: string,
  rowIds: string[],
  rowSeatCounts: Record<string, number>,
  isSeatSaverSection: boolean,
  isSoldOut: boolean,
  rng: ReturnType<typeof createSeededRandom>,
): RowInventory {
  const unmappedListingIds = new Set<string>();
  let listingCounter = 1;

  // Fully sold-out sections: every seat is unavailable
  if (isSoldOut) {
    const rows: RowData[] = rowIds.map((rowId) => {
      const seatCount = rowSeatCounts[rowId] ?? 0;
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => ({
        seatId: `${sectionId}:${rowId}:s${si + 1}`,
        status: 'unavailable' as const,
      }));
      return { rowId, seats };
    });
    return { sectionData: { sectionId, rows }, unmappedListingIds };
  }

  const rows: RowData[] = rowIds.map((rowId, rowIndex) => {
    const seatCount = rowSeatCounts[rowId] ?? 0;
    if (seatCount === 0) {
      return { rowId, seats: [] };
    }

    // Seat saver: last row of designated sections → single unmapped listing covering all seats
    const isLastRow = rowIndex === rowIds.length - 1;
    if (isSeatSaverSection && isLastRow) {
      const listingId = `listing-${sectionId}-${rowId}-saver`;
      unmappedListingIds.add(listingId);
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => ({
        seatId: `${sectionId}:${rowId}:s${si + 1}`,
        status: 'available' as const,
        listingId,
      }));
      return { rowId, seats };
    }

    // Full row listing (2% probability)
    if (rng.random() < 0.02) {
      const listingId = `listing-${sectionId}-${rowId}-${listingCounter++}`;
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => ({
        seatId: `${sectionId}:${rowId}:s${si + 1}`,
        status: 'available' as const,
        listingId,
      }));
      return { rowId, seats };
    }

    // Solo row (1% probability): each available seat is its own listing
    if (rng.random() < 0.01) {
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => {
        const isUnavailable = rng.random() < 0.93;
        const seatId = `${sectionId}:${rowId}:s${si + 1}`;
        if (isUnavailable) return { seatId, status: 'unavailable' as const };
        const listingId = `listing-${sectionId}-${rowId}-${listingCounter++}`;
        return { seatId, status: 'available' as const, listingId };
      });
      return { rowId, seats };
    }

    // Zone row (10% of normal rows)
    if (rng.random() < 0.10) {
      const half = Math.ceil(seatCount / 2);
      const listingId1 = `listing-${sectionId}-${rowId}-${listingCounter++}`;
      const listingId2 = `listing-${sectionId}-${rowId}-${listingCounter++}`;
      unmappedListingIds.add(listingId2);
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => ({
        seatId: `${sectionId}:${rowId}:s${si + 1}`,
        status: 'available' as const,
        listingId: si < half ? listingId1 : listingId2,
      }));
      return { rowId, seats, isZoneRow: true };
    }

    // Normal row: ~93% unavailable, group available seats into listings
    const available: number[] = [];
    const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => {
      const seatId = `${sectionId}:${rowId}:s${si + 1}`;
      if (rng.random() < 0.93) return { seatId, status: 'unavailable' as const };
      available.push(si);
      return { seatId, status: 'available' as const };
    });

    // Group available seats — group size based on row width
    const [minG, maxG] = seatCount <= 8 ? [1, 3] : seatCount <= 15 ? [2, 6] : [2, 10];
    let i = 0;
    while (i < available.length) {
      // Find consecutive run
      let runEnd = i;
      while (
        runEnd + 1 < available.length &&
        available[runEnd + 1]! === available[runEnd]! + 1
      ) {
        runEnd++;
      }
      let pos = i;
      while (pos <= runEnd) {
        const remaining = runEnd - pos + 1;
        const groupSize = remaining >= minG
          ? rng.randInt(minG, Math.min(maxG, remaining) + 1)
          : remaining;
        const listingId = `listing-${sectionId}-${rowId}-${listingCounter++}`;
        for (let k = 0; k < groupSize; k++) {
          const seatIdx = available[pos + k]!;
          seats[seatIdx]!.listingId = listingId;
        }
        pos += groupSize;
      }
      i = runEnd + 1;
    }

    return { rowId, seats };
  });

  return {
    sectionData: { sectionId, rows },
    unmappedListingIds,
  };
}

function extractListings(
  sectionData: SectionData,
  sectionId: string,
  numRows: number,
  priceRange: [number, number],
  unmappedListingIds: Set<string>,
  rng: ReturnType<typeof createSeededRandom>,
): Listing[] {
  const groups = new Map<string, { rowId: string; rowNumber: number; seatIds: string[] }>();

  sectionData.rows.forEach((row, rowIndex) => {
    row.seats.forEach((seat) => {
      if (seat.status === 'unavailable' || !seat.listingId) return;
      const existing = groups.get(seat.listingId);
      if (existing) {
        existing.seatIds.push(seat.seatId);
      } else {
        groups.set(seat.listingId, {
          rowId: row.rowId,
          rowNumber: rowIndex + 1,
          seatIds: [seat.seatId],
        });
      }
    });
  });

  const listings: Listing[] = [];
  groups.forEach((group, listingId) => {
    const price = rng.randInt(priceRange[0], priceRange[1] + 1);
    const feePerTicket = rng.randInt(800, 2500);
    const delivery = DELIVERY_OPTIONS[rng.randInt(0, 2)]!;

    const perks: Perk[] = [];
    if (group.rowNumber === 1) perks.push('front_of_section');
    if (rng.random() < 0.15) perks.push('aisle');
    if (rng.random() < 0.10) perks.push('food_and_drink');

    const posScore = numRows > 1 ? (1 - (group.rowNumber - 1) / (numRows - 1)) * 5 : 2.5;
    const priceScore = (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * 4;
    const dealScore =
      Math.round(Math.max(0, Math.min(10, posScore + priceScore + (rng.random() - 0.5))) * 10) / 10;

    const isUnmapped = unmappedListingIds.has(listingId);

    const listing: Listing = {
      listingId,
      sectionId,
      sectionLabel: sectionId,
      rowId: group.rowId,
      rowNumber: group.rowNumber,
      seatIds: group.seatIds,
      price,
      seatViewUrl: seatViewImg,
      perks,
      dealScore,
      quantityAvailable: group.seatIds.length,
      feePerTicket,
      delivery,
    };
    if (isUnmapped) listing.isUnmapped = true;
    listings.push(listing);
  });

  return listings;
}

export function createManifestSeatMapModel(): SeatMapModel {
  const sectionIds = Object.keys(seatCounts).sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  const seatSaverSections = pickSeatSaverSections(sectionIds, 3);

  // Sections with zero inventory — deterministically pick a few to be completely sold out
  const soldOutSections = new Set<string>();
  {
    const pool = [...sectionIds];
    let seed = hashString(`${SEED}-soldout`);
    const count = 10; // number of fully sold-out sections
    while (soldOutSections.size < count && pool.length > 0) {
      seed = hashString(`${seed}`);
      const idx = Math.abs(seed) % pool.length;
      soldOutSections.add(pool[idx]!);
      pool.splice(idx, 1);
    }
  }

  const sections: SectionConfig[] = [];
  const sectionDataById = new Map<string, SectionData>();
  const allListings: Listing[] = [];
  const pinsBySection = new Map<string, PinData[]>();

  for (const sectionId of sectionIds) {
    const rawRowSeatCounts = seatCounts[sectionId]!;
    // Lowercase row IDs to match GeoJSON feature IDs (pipeline outputs lowercase)
    const rowSeatCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(rawRowSeatCounts)) {
      rowSeatCounts[k.toLowerCase()] = v;
    }
    // Sort row IDs numerically
    const rowIds = Object.keys(rowSeatCounts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (rowIds.length === 0) continue;

    const numRows = rowIds.length;
    const maxSeatsPerRow = Math.max(...Object.values(rowSeatCounts));

    const sectionConfig: SectionConfig = {
      sectionId,
      label: sectionId,
      numRows,
      seatsPerRow: maxSeatsPerRow,
      x: 0,
      y: 0,
      zone: getZoneName(sectionId),
    };
    sections.push(sectionConfig);

    // Build section inventory
    const sectionSeed = hashString(`${SEED}-${sectionId}`);
    const rng = createSeededRandom(sectionSeed);
    const { sectionData, unmappedListingIds } = buildSectionInventory(
      sectionId,
      rowIds,
      rowSeatCounts,
      seatSaverSections.has(sectionId),
      soldOutSections.has(sectionId),
      rng,
    );
    sectionDataById.set(sectionId, sectionData);

    // Extract listings
    const priceSeed = hashString(`${SEED}-prices-${sectionId}`);
    const priceRng = createSeededRandom(priceSeed);
    const priceRange = getPriceRange(sectionId);
    const sectionListings = extractListings(
      sectionData,
      sectionId,
      numRows,
      priceRange,
      unmappedListingIds,
      priceRng,
    );
    allListings.push(...sectionListings);

    // Pins: pick up to 3 per section from first-row listings
    if (sectionListings.length > 0) {
      const pinSeed = hashString(`${SEED}-pins-${sectionId}`);
      const pinRng = createSeededRandom(pinSeed);
      const candidates: PinData[] = sectionListings.map((listing) => ({
        listing,
        rowIndex: listing.rowNumber - 1,
        seatIndex: listing.seatIds.length > 0
          ? Math.floor(listing.seatIds.length / 2)
          : 0,
      }));
      pinRng.shuffle(candidates);

      const selected: PinData[] = [];
      for (const candidate of candidates) {
        const tooClose = selected.some(
          (pin) =>
            Math.max(
              Math.abs(pin.rowIndex - candidate.rowIndex),
              Math.abs(pin.seatIndex - candidate.seatIndex),
            ) < 3,
        );
        if (!tooClose) {
          selected.push(candidate);
          if (selected.length >= 3) break;
        }
      }

      if (selected.length > 0) {
        pinsBySection.set(sectionId, selected);
      }
    }
  }

  // Shuffle listings
  const shuffleRng = createSeededRandom(hashString(`${SEED}-shuffle`));
  shuffleRng.shuffle(allListings);

  const listingsBySection = new Map<string, Listing[]>();
  for (const listing of allListings) {
    const existing = listingsBySection.get(listing.sectionId);
    if (existing) {
      existing.push(listing);
    } else {
      listingsBySection.set(listing.sectionId, [listing]);
    }
  }

  const mapConfig: MapConfig = {
    id: 'camden-yards',
    name: 'Oriole Park at Camden Yards',
    sections,
    seed: SEED,
  };

  return {
    ...mapConfig,
    sectionDataById,
    listings: allListings,
    listingsBySection,
    pinsBySection,
    eventInfo: VENUE_EVENT_INFO,
  };
}
