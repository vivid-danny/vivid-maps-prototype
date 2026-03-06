import venueData from './venueData.json';
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

// Types for the raw venue data JSON
interface VenueElement {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  d: string;
}

interface SectionBoundary {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  d: string;
  lx: number;
  ly: number;
  rows: number;
}

interface VenueDataJson {
  meta: { frameSize: [number, number]; sectionCount: number };
  venue: VenueElement[];
  sections: Record<string, SectionBoundary>;
  seats: Record<string, number[][]>;
}

// Exported for the renderer to use
export interface VenueGeometry {
  frameWidth: number;
  frameHeight: number;
  venueElements: VenueElement[];
  sectionBoundaries: Map<string, SectionBoundary>;
  seatPositions: Map<string, number[][]>; // sectionId -> rows of [x1,y1,x2,y2,...]
}

const DELIVERY_OPTIONS: DeliveryInfo[] = [
  {
    method: 'mobile_transfer',
    label: 'Mobile Transfer',
    description: 'When your tickets are ready, we\'ll send them to the email address on your account.',
  },
  {
    method: 'instant_download',
    label: 'Instant Download',
    description: 'Your tickets will be available for immediate download after purchase.',
  },
];

const VENUE_EVENT_INFO: EventInfo = {
  eventName: 'Chicago Cubs vs. St. Louis Cardinals',
  eventDate: 'Fri, Jul 4, 2025 at 1:20pm',
  venueName: 'Wrigley Field',
  venueAddress: '1060 W Addison St, Chicago, IL 60613',
};

const SEED = 54321;

// Per-section inventory profile for varied, realistic inventory
interface InventoryProfile {
  unavailableRatio: number;
  soldOutRows?: number[];       // 1-indexed rows that are fully sold out
  zoneRows?: { row: number; mappedRatio: number }[];  // rows with mixed mapped/unmapped
  singleListingRows?: number[]; // rows where all seats are one listing
  seatsPerListing?: [number, number]; // [min, max] group size
}

// Zone assignment based on Wrigley Field layout
// Home plate is around section 17/117/217 — closer sections get lower tiers (premium)
function getZoneName(sectionId: string): string {
  const num = parseInt(sectionId);
  if (isNaN(num)) return 'alt-mid';

  // Distance from home plate axis (17 for field, 117 for 100s, 217 for 200s)
  const base = num < 100 ? 17 : num < 200 ? 117 : 217;
  const dist = Math.abs(num - base);

  if (num < 100) {
    // Field level: tier 1 (close) to tier 2 (far), with primary/secondary/tertiary by distance
    if (dist <= 3) return 'tier-1-primary';
    if (dist <= 6) return 'tier-1-secondary';
    if (dist <= 9) return 'tier-1-tertiary';
    return 'alt-close';
  }

  if (num < 200) {
    // 100 level: tier 2/3
    if (dist <= 3) return 'tier-2-primary';
    if (dist <= 6) return 'tier-2-secondary';
    if (dist <= 9) return 'tier-3-primary';
    return 'alt-mid';
  }

  // 200 level: tier 4/5
  if (dist <= 3) return 'tier-4-primary';
  if (dist <= 6) return 'tier-4-secondary';
  if (dist <= 9) return 'tier-5-primary';
  return 'alt-far';
}

// Deterministic inventory profiles based on section ID
function getInventoryProfile(sectionId: string): InventoryProfile {
  const num = parseInt(sectionId);

  // Sold-out sections
  if (num === 18 || num === 110 || num === 216) {
    return { unavailableRatio: 1.0 };
  }

  // Field level (5-29): premium, heavily sold
  if (num >= 5 && num <= 29) {
    if (num === 12 || num === 23) {
      return {
        unavailableRatio: 0.75,
        zoneRows: [
          { row: 3, mappedRatio: 0.6 },
          { row: 8, mappedRatio: 0.0 },
        ],
        seatsPerListing: [2, 6],
      };
    }
    if (num === 9 || num === 25) {
      return {
        unavailableRatio: 0.78,
        singleListingRows: [num === 9 ? 10 : 10],
        seatsPerListing: [2, 8],
      };
    }
    if (num === 6 || num === 28) {
      return {
        unavailableRatio: 0.75,
        soldOutRows: [3, 4, 5],
        seatsPerListing: [2, 6],
      };
    }
    return { unavailableRatio: 0.72 + (num % 5) * 0.02, seatsPerListing: [2, 6] };
  }

  // 100 level (105-129): mid-tier, ~75% unavailable base
  if (num >= 105 && num <= 129) {
    if (num === 112 || num === 125) {
      return {
        unavailableRatio: 0.78,
        zoneRows: [
          { row: 5, mappedRatio: 0.5 },
          { row: 12, mappedRatio: 0.0 },
        ],
        seatsPerListing: [2, 8],
      };
    }
    if (num === 107 || num === 126) {
      return {
        unavailableRatio: 0.78,
        singleListingRows: [15],
        seatsPerListing: [2, 8],
      };
    }
    if (num === 109 || num === 122) {
      return {
        unavailableRatio: 0.75,
        soldOutRows: [6, 7, 8],
        seatsPerListing: [2, 6],
      };
    }
    return { unavailableRatio: 0.73 + (num % 4) * 0.02, seatsPerListing: [2, 8] };
  }

  // 200 level (206-228): upper deck, ~80% unavailable base
  if (num >= 206) {
    if (num === 213 || num === 222) {
      return {
        unavailableRatio: 0.82,
        zoneRows: [
          { row: 4, mappedRatio: 0.6 },
          { row: 15, mappedRatio: 0.0 },
        ],
        seatsPerListing: [2, 10],
      };
    }
    if (num === 210 || num === 220) {
      return {
        unavailableRatio: 0.82,
        singleListingRows: [num === 210 ? 22 : 23],
        seatsPerListing: [2, 8],
      };
    }
    if (num === 208 || num === 226) {
      return {
        unavailableRatio: 0.80,
        soldOutRows: [10, 11, 12],
        seatsPerListing: [2, 8],
      };
    }
    return { unavailableRatio: 0.78 + (num % 3) * 0.02, seatsPerListing: [2, 10] };
  }

  return { unavailableRatio: 0.75 };
}

function buildSectionData(
  sectionId: string,
  seatRows: number[][],
  profile: InventoryProfile,
  rng: ReturnType<typeof createSeededRandom>,
): SectionData {
  const { unavailableRatio, soldOutRows, zoneRows, singleListingRows } = profile;
  const soldOutSet = new Set(soldOutRows ?? []);
  const zoneRowMap = new Map((zoneRows ?? []).map(zr => [zr.row, zr]));
  const singleListingSet = new Set(singleListingRows ?? []);

  // Fully sold out section
  if (unavailableRatio >= 1.0) {
    const rows: RowData[] = seatRows.map((flatCoords, rowIndex) => {
      const seatCount = flatCoords.length / 2;
      const rowId = `${sectionId}-${rowIndex + 1}`;
      return {
        rowId,
        seats: Array.from({ length: seatCount }, (_, seatIndex) => ({
          seatId: `${rowId}-${seatIndex + 1}`,
          status: 'unavailable' as const,
        })),
      };
    });
    return { sectionId, rows };
  }

  const rows: RowData[] = seatRows.map((flatCoords, rowIndex) => {
    const seatCount = flatCoords.length / 2;
    const rowNum = rowIndex + 1;
    const rowId = `${sectionId}-${rowNum}`;

    // Sold-out row
    if (soldOutSet.has(rowNum)) {
      return {
        rowId,
        seats: Array.from({ length: seatCount }, (_, seatIndex) => ({
          seatId: `${rowId}-${seatIndex + 1}`,
          status: 'unavailable' as const,
        })),
      };
    }

    // Zone row: mixed mapped/unmapped inventory
    const zoneConfig = zoneRowMap.get(rowNum);
    if (zoneConfig) {
      const mappedCount = zoneConfig.mappedRatio > 0
        ? Math.floor(seatCount * zoneConfig.mappedRatio)
        : Math.ceil(seatCount / 2);
      const listingId1 = `listing-${sectionId}-zone-${rowNum}-1`;
      const listingId2 = `listing-${sectionId}-zone-${rowNum}-2`;

      const seats: SeatData[] = Array.from({ length: seatCount }, (_, seatIndex) => {
        const seatNum = seatIndex + 1;
        const isMapped = seatNum <= mappedCount && zoneConfig.mappedRatio > 0;
        const seatId = isMapped ? `${rowId}-${seatNum}` : `${rowId}-zone-${seatNum}`;
        const listingId = seatNum <= mappedCount ? listingId1 : listingId2;
        return { seatId, status: 'available' as const, listingId };
      });

      return { rowId, seats, isZoneRow: true };
    }

    // Single listing row: all seats are one listing
    if (singleListingSet.has(rowNum)) {
      const listingId = `listing-${sectionId}-row-${rowNum}`;
      return {
        rowId,
        seats: Array.from({ length: seatCount }, (_, seatIndex) => ({
          seatId: `${rowId}-${seatIndex + 1}`,
          status: 'available' as const,
          listingId,
        })),
      };
    }

    // Normal row: random unavailable + grouping
    const seats: SeatData[] = Array.from({ length: seatCount }, (_, seatIndex) => {
      const seatId = `${rowId}-${seatIndex + 1}`;
      const isUnavailable = rng.random() < unavailableRatio;
      return {
        seatId,
        status: isUnavailable ? 'unavailable' as const : 'available' as const,
      };
    });

    return { rowId, seats };
  });

  return { sectionId, rows };
}

function assignListings(
  sectionData: SectionData,
  sectionId: string,
  profile: InventoryProfile,
  rng: ReturnType<typeof createSeededRandom>,
): void {
  const [minGroup, maxGroup] = profile.seatsPerListing ?? [2, 7];
  let listingIndex = 1;

  for (const row of sectionData.rows) {
    // Skip rows that already have listings assigned (zone rows, single listing rows)
    if (row.seats.every(s => s.listingId || s.status === 'unavailable')) continue;

    let i = 0;
    while (i < row.seats.length) {
      const seat = row.seats[i];
      if (seat.status === 'unavailable') {
        i++;
        continue;
      }

      // Find run of consecutive available seats
      let runEnd = i;
      while (runEnd + 1 < row.seats.length && row.seats[runEnd + 1].status === 'available') {
        runEnd++;
      }

      // Split into groups
      let pos = i;
      while (pos <= runEnd) {
        const remaining = runEnd - pos + 1;
        const groupSize = remaining >= minGroup
          ? rng.randInt(minGroup, Math.min(maxGroup, remaining) + 1)
          : remaining;
        const listingId = `listing-${sectionId}-${listingIndex++}`;
        for (let k = 0; k < groupSize; k++) {
          row.seats[pos + k].listingId = listingId;
        }
        pos += groupSize;
      }

      i = runEnd + 1;
    }
  }
}

function extractListings(
  sectionData: SectionData,
  sectionId: string,
  label: string,
  numRows: number,
  priceRange: [number, number],
  rng: ReturnType<typeof createSeededRandom>,
): Listing[] {
  const listings: Listing[] = [];
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

  groups.forEach((group, listingId) => {
    const price = rng.randInt(priceRange[0], priceRange[1] + 1);
    const feePerTicket = rng.randInt(800, 2500);
    const delivery = DELIVERY_OPTIONS[rng.randInt(0, 2)];

    const perks: Perk[] = [];
    if (group.rowNumber === 1) perks.push('front_of_section');
    if (rng.random() < 0.15) perks.push('aisle');
    if (rng.random() < 0.10) perks.push('food_and_drink');

    // Simple deal score based on row position + price
    const posScore = numRows > 1 ? (1 - (group.rowNumber - 1) / (numRows - 1)) * 5 : 2.5;
    const priceScore = (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * 4;
    const dealScore = Math.round(Math.max(0, Math.min(10, posScore + priceScore + (rng.random() - 0.5))) * 10) / 10;

    // Detect unmapped listings: all seatIds contain the "-zone-" synthetic pattern
    const isUnmapped = group.seatIds.every((id) => id.includes('-zone-'));

    const listing: Listing = {
      listingId,
      sectionId,
      sectionLabel: label,
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

function selectPins(
  listings: Listing[],
  seatPositions: number[][],
  rng: ReturnType<typeof createSeededRandom>,
): PinData[] {
  if (listings.length === 0) return [];

  const candidates: PinData[] = [];
  for (const listing of listings) {
    const rowIndex = listing.rowNumber - 1;
    if (rowIndex >= seatPositions.length) continue;
    const rowCoords = seatPositions[rowIndex];
    const seatCount = rowCoords.length / 2;
    const seatIndex = Math.min(Math.floor(seatCount / 2), seatCount - 1);
    candidates.push({ listing, rowIndex, seatIndex });
  }

  rng.shuffle(candidates);

  // Greedy placement with distance check
  const selected: PinData[] = [];
  for (const candidate of candidates) {
    const tooClose = selected.some(
      (pin) => Math.max(Math.abs(pin.rowIndex - candidate.rowIndex), Math.abs(pin.seatIndex - candidate.seatIndex)) < 3
    );
    if (!tooClose) {
      selected.push(candidate);
    }
  }

  return selected;
}

export interface VenueSeatMapModel extends SeatMapModel {
  geometry: VenueGeometry;
}

export function createVenueSeatMapModel(): VenueSeatMapModel {
  const data = venueData as VenueDataJson;
  const [frameWidth, frameHeight] = data.meta.frameSize;

  // Build geometry for the renderer
  const sectionBoundaries = new Map<string, SectionBoundary>();
  for (const [id, boundary] of Object.entries(data.sections)) {
    sectionBoundaries.set(id, boundary);
  }
  const seatPositions = new Map<string, number[][]>();
  for (const [id, rows] of Object.entries(data.seats)) {
    seatPositions.set(id, rows);
  }

  const geometry: VenueGeometry = {
    frameWidth,
    frameHeight,
    venueElements: data.venue,
    sectionBoundaries,
    seatPositions,
  };

  // Build SectionConfig[] and SectionData for each section
  const sections: SectionConfig[] = [];
  const sectionDataById = new Map<string, SectionData>();
  const allListings: Listing[] = [];
  const pinsBySection = new Map<string, PinData[]>();

  const sectionIds = Object.keys(data.sections).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1;
    if (!isNaN(nb)) return 1;
    return a.localeCompare(b);
  });

  for (const sectionId of sectionIds) {
    const boundary = data.sections[sectionId];
    const seatRows = data.seats[sectionId];
    if (!seatRows || seatRows.length === 0) continue;

    const maxSeatsPerRow = Math.max(...seatRows.map((r) => r.length / 2));
    const numRows = seatRows.length;

    const profile = getInventoryProfile(sectionId);

    const sectionConfig: SectionConfig = {
      sectionId,
      label: sectionId,
      numRows,
      seatsPerRow: maxSeatsPerRow,
      x: boundary.bx,
      y: boundary.by,
      unavailableRatio: profile.unavailableRatio,
      soldOutRows: profile.soldOutRows,
      seatZoneRows: profile.zoneRows,
      singleListingRows: profile.singleListingRows,
      seatsPerListing: profile.seatsPerListing,
      zone: getZoneName(sectionId),
    };
    sections.push(sectionConfig);

    // Generate section data
    const sectionSeed = hashString(`${SEED}-${sectionId}`);
    const rng = createSeededRandom(sectionSeed);
    const sectionData = buildSectionData(sectionId, seatRows, profile, rng);
    assignListings(sectionData, sectionId, profile, rng);
    sectionDataById.set(sectionId, sectionData);

    // Generate listings
    const priceSeed = hashString(`${SEED}-prices-${sectionId}`);
    const priceRng = createSeededRandom(priceSeed);
    // Price varies by distance from field (lower section numbers = closer)
    const sectionNum = parseInt(sectionId);
    const priceRange: [number, number] = !isNaN(sectionNum) && sectionNum < 100
      ? [15000, 45000]  // field level: $150-450
      : !isNaN(sectionNum) && sectionNum < 200
      ? [8000, 25000]   // 100 level: $80-250
      : [3000, 12000];  // 200 level / other: $30-120

    const sectionListings = extractListings(sectionData, sectionId, sectionId, numRows, priceRange, priceRng);
    allListings.push(...sectionListings);

    // Generate pins
    const pinSeed = hashString(`${SEED}-pins-${sectionId}`);
    const pinRng = createSeededRandom(pinSeed);
    const pins = selectPins(sectionListings, seatRows, pinRng);
    if (pins.length > 0) {
      pinsBySection.set(sectionId, pins);
    }
  }

  // Shuffle all listings
  const shuffleRng = createSeededRandom(hashString(`${SEED}-shuffle`));
  shuffleRng.shuffle(allListings);

  // Build listingsBySection
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
    id: 'wrigley-field',
    name: 'Wrigley Field',
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
    geometry,
  };
}
