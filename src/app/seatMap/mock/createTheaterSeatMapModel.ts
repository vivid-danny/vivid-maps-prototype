import theaterVenueData from './theaterVenueData.json';
import { createSeededRandom } from './seededRandom';
import { hashString, parseSeatId } from '../behavior/utils';
import seatViewImg from '../../../assets/seatView.png';
import type {
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
import type { VenueSeatMapModel, VenueGeometry } from './createVenueSeatMapModel';

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

const THEATER_EVENT_INFO: EventInfo = {
  eventName: 'Hamilton',
  eventDate: 'Sat, Aug 16, 2025 at 8:00pm',
  venueName: 'CIBC Theatre',
  venueAddress: '18 W Monroe St, Chicago, IL 60603',
};

const SEED = 11111;

interface InventoryProfile {
  unavailableRatio: number;
  soldOutRows?: number[];
  seatsPerListing?: [number, number];
}

function getZoneName(sectionId: string): string {
  if (sectionId.startsWith('vip')) return 'vip';
  if (sectionId === '100L' || sectionId === '100R') return 'orchestra-side';
  if (['101', '102', '103', '104', '105'].includes(sectionId)) return 'orchestra';
  if (sectionId === '200L' || sectionId === '200R') return 'mezzanine-side';
  if (['201', '202', '203', '204', '205'].includes(sectionId)) return 'mezzanine';
  if (sectionId === '300L' || sectionId === '300R') return 'balcony-side';
  return 'balcony';
}

function getPriceRange(sectionId: string): [number, number] {
  if (sectionId.startsWith('vip')) return [20000, 50000];
  if (sectionId === '100L' || sectionId === '100R') return [10000, 25000];
  if (['101', '102', '103', '104', '105'].includes(sectionId)) return [15000, 35000];
  if (sectionId === '200L' || sectionId === '200R') return [6000, 13000];
  if (['201', '202', '203', '204', '205'].includes(sectionId)) return [8000, 18000];
  if (sectionId === '300L' || sectionId === '300R') return [3000, 7000];
  return [4000, 9000];
}

function getInventoryProfile(sectionId: string): InventoryProfile {
  if (sectionId === '103') return { unavailableRatio: 1.0 };
  if (sectionId.startsWith('vip')) return { unavailableRatio: 0.4, seatsPerListing: [1, 2] };
  if (sectionId === '100L' || sectionId === '100R') return { unavailableRatio: 0.5, seatsPerListing: [1, 2] };
  if (sectionId === '200L' || sectionId === '200R') return { unavailableRatio: 0.7, seatsPerListing: [1, 3] };
  if (sectionId === '300L' || sectionId === '300R') return { unavailableRatio: 0.7, seatsPerListing: [1, 3] };
  if (['101', '105'].includes(sectionId)) return { unavailableRatio: 0.55, seatsPerListing: [1, 4] };
  if (['102', '104'].includes(sectionId)) return { unavailableRatio: 0.65, seatsPerListing: [2, 6] };
  if (['201', '205'].includes(sectionId)) return { unavailableRatio: 0.60, seatsPerListing: [2, 4] };
  if (['202', '204'].includes(sectionId)) return { unavailableRatio: 0.65, seatsPerListing: [2, 6] };
  if (sectionId === '203') return { unavailableRatio: 0.70, seatsPerListing: [2, 6] };
  if (['302', '304'].includes(sectionId)) return { unavailableRatio: 0.60, seatsPerListing: [2, 6] };
  if (sectionId === '303') return { unavailableRatio: 0.65, seatsPerListing: [2, 8] };
  return { unavailableRatio: 0.65, seatsPerListing: [2, 6] };
}

function buildSectionData(
  sectionId: string,
  seatRows: number[][],
  profile: InventoryProfile,
  rng: ReturnType<typeof createSeededRandom>,
): SectionData {
  const { unavailableRatio, soldOutRows } = profile;
  const soldOutSet = new Set(soldOutRows ?? []);

  if (unavailableRatio >= 1.0) {
    const rows: RowData[] = seatRows.map((flatCoords, rowIndex) => {
      const seatCount = flatCoords.length / 2;
      const rowId = `${sectionId}-${rowIndex + 1}`;
      return {
        rowId,
        seats: Array.from({ length: seatCount }, (_, i) => ({
          seatId: `${rowId}-${i + 1}`,
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

    if (soldOutSet.has(rowNum)) {
      return {
        rowId,
        seats: Array.from({ length: seatCount }, (_, i) => ({
          seatId: `${rowId}-${i + 1}`,
          status: 'unavailable' as const,
        })),
      };
    }

    const seats: SeatData[] = Array.from({ length: seatCount }, (_, i) => ({
      seatId: `${rowId}-${i + 1}`,
      status: rng.random() < unavailableRatio ? 'unavailable' as const : 'available' as const,
    }));
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
    if (row.seats.every(s => s.listingId || s.status === 'unavailable')) continue;

    let i = 0;
    while (i < row.seats.length) {
      const seat = row.seats[i];
      if (seat.status === 'unavailable') { i++; continue; }

      let runEnd = i;
      while (runEnd + 1 < row.seats.length && row.seats[runEnd + 1].status === 'available') runEnd++;

      let pos = i;
      while (pos <= runEnd) {
        const remaining = runEnd - pos + 1;
        const groupSize = remaining >= minGroup
          ? rng.randInt(minGroup, Math.min(maxGroup, remaining) + 1)
          : remaining;
        const listingId = `listing-${sectionId}-${listingIndex++}`;
        for (let k = 0; k < groupSize; k++) row.seats[pos + k].listingId = listingId;
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
        groups.set(seat.listingId, { rowId: row.rowId, rowNumber: rowIndex + 1, seatIds: [seat.seatId] });
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

    const posScore = numRows > 1 ? (1 - (group.rowNumber - 1) / (numRows - 1)) * 5 : 2.5;
    const priceScore = (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * 4;
    const dealScore = Math.round(Math.max(0, Math.min(10, posScore + priceScore + (rng.random() - 0.5))) * 10) / 10;

    listings.push({
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
    });
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

    const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
    const parsed = middleSeatId ? parseSeatId(middleSeatId) : null;
    const seatIndex = parsed
      ? Math.min(parsed.seatNumber - 1, seatCount - 1)
      : Math.min(Math.floor(seatCount / 2), seatCount - 1);

    candidates.push({ listing, rowIndex, seatIndex });
  }

  rng.shuffle(candidates);

  const selected: PinData[] = [];
  for (const candidate of candidates) {
    const tooClose = selected.some(
      (pin) => Math.max(Math.abs(pin.rowIndex - candidate.rowIndex), Math.abs(pin.seatIndex - candidate.seatIndex)) < 3
    );
    if (!tooClose) selected.push(candidate);
  }

  return selected;
}

// Re-use VenueGeometry shape — same JSON format as stadium
interface VenueElement { name: string; x: number; y: number; w: number; h: number; fill: string; d: string; }
interface SectionBoundary { bx: number; by: number; bw: number; bh: number; d: string; lx: number; ly: number; rows: number; }
interface VenueDataJson {
  meta: { frameSize: [number, number]; sectionCount: number };
  venue: VenueElement[];
  sections: Record<string, SectionBoundary>;
  seats: Record<string, number[][]>;
}

export function createTheaterSeatMapModel(): VenueSeatMapModel {
  const data = theaterVenueData as VenueDataJson;
  const [frameWidth, frameHeight] = data.meta.frameSize;

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

  const sections: SectionConfig[] = [];
  const sectionDataById = new Map<string, SectionData>();
  const allListings: Listing[] = [];
  const pinsBySection = new Map<string, PinData[]>();

  const sectionIds = Object.keys(data.sections).sort((a, b) => {
    // Sort: vip first, then 100s, 200s, 300s
    const order = (id: string) => {
      if (id.startsWith('vip')) return 0;
      const n = parseInt(id);
      if (!isNaN(n)) return n;
      // side sections like 100L/R: parse as number + offset
      const num = parseInt(id);
      return isNaN(num) ? 999 : num;
    };
    return order(a) - order(b);
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
      seatsPerListing: profile.seatsPerListing,
      zone: getZoneName(sectionId),
    };
    sections.push(sectionConfig);

    const sectionSeed = hashString(`${SEED}-${sectionId}`);
    const rng = createSeededRandom(sectionSeed);
    const sectionData = buildSectionData(sectionId, seatRows, profile, rng);
    assignListings(sectionData, sectionId, profile, rng);
    sectionDataById.set(sectionId, sectionData);

    const priceSeed = hashString(`${SEED}-prices-${sectionId}`);
    const priceRng = createSeededRandom(priceSeed);
    const priceRange = getPriceRange(sectionId);
    const sectionListings = extractListings(sectionData, sectionId, sectionId, numRows, priceRange, priceRng);
    allListings.push(...sectionListings);

    const pinSeed = hashString(`${SEED}-pins-${sectionId}`);
    const pinRng = createSeededRandom(pinSeed);
    const pins = selectPins(sectionListings, seatRows, pinRng);
    if (pins.length > 0) pinsBySection.set(sectionId, pins);
  }

  const shuffleRng = createSeededRandom(hashString(`${SEED}-shuffle`));
  shuffleRng.shuffle(allListings);

  const listingsBySection = new Map<string, Listing[]>();
  for (const listing of allListings) {
    const existing = listingsBySection.get(listing.sectionId);
    if (existing) existing.push(listing);
    else listingsBySection.set(listing.sectionId, [listing]);
  }

  const mapConfig: MapConfig = {
    id: 'cibc-theatre',
    name: 'CIBC Theatre',
    sections,
    seed: SEED,
  };

  return {
    ...mapConfig,
    sectionDataById,
    listings: allListings,
    listingsBySection,
    pinsBySection,
    eventInfo: THEATER_EVENT_INFO,
    geometry,
  };
}
