import seatCountsRaw from './venueSeatCounts.json';
import { createSeededRandom } from './seededRandom';
import { hashString } from '../behavior/utils';
import { buildSeatFeatureId } from '../model/ids';
import { isAisleListing } from '../model/perks';
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
const DEAL_SCORE_BIAS = 0.8;
const LISTING_DENSITY_SCALE = 0.45;

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

interface RowInventory {
  sectionData: SectionData;
  unmappedListingIds: Set<string>;
}

interface DeterministicSectionScenarioConfig {
  sectionId: string;
  mixedRowId: string;
}

interface DeterministicSectionScenario extends DeterministicSectionScenarioConfig {
  backRowId: string;
  mappedFullRowId: string;
}

interface ListingGroupSpec {
  listingId: string;
  rowId: string | null;
  rowNumber: number | null;
  quantityAvailable: number;
  seatIds: string[];
  isUnmapped?: boolean;
  bucketRowId?: string;
}

const DETERMINISTIC_SECTION_SCENARIOS: DeterministicSectionScenarioConfig[] = [
  { sectionId: '214', mixedRowId: '5' },
  { sectionId: '316', mixedRowId: '12' },
  { sectionId: '24', mixedRowId: '13' },
];

function sortRowIds(rowSeatCounts: Record<string, number>): string[] {
  return Object.keys(rowSeatCounts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function resolveDeterministicSectionScenario(
  sectionId: string,
  rowIds: string[],
): DeterministicSectionScenario | null {
  const config = DETERMINISTIC_SECTION_SCENARIOS.find((scenario) => scenario.sectionId === sectionId);
  if (!config || rowIds.length === 0) return null;

  const backRowId = rowIds[rowIds.length - 1]!;
  const mappedFullRowId = rowIds.find((rowId) => rowId !== config.mixedRowId && rowId !== backRowId) ?? null;
  if (!mappedFullRowId) return null;

  return {
    ...config,
    backRowId,
    mappedFullRowId,
  };
}

function buildClusteredRowSeats(
  sectionId: string,
  rowId: string,
  seatCount: number,
  nextListingId: () => string,
  rng: ReturnType<typeof createSeededRandom>,
): SeatData[] {
  const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => ({
    seatId: buildSeatFeatureId(sectionId, rowId, si + 1),
    status: 'unavailable' as const,
  }));

  if (seatCount === 0) return seats;

  const rowDensity = 0.4 + (rng.random() * 0.75);
  if (rng.random() < 0.5 + ((1 - rowDensity) * 0.18)) return seats;

  const interiorStart = seatCount >= 6 ? 1 : 0;
  const interiorEnd = seatCount >= 6 ? seatCount - 2 : seatCount - 1;
  const [minBlockSize, maxBlockSize] = seatCount <= 4
    ? [1, 2]
    : seatCount <= 8
      ? [2, 4]
      : seatCount <= 15
        ? [3, 6]
        : [4, 8];
  const baseTargetBlocks = seatCount <= 8
    ? rng.randInt(1, 3)
    : seatCount <= 15
      ? rng.randInt(1, 4)
      : rng.randInt(2, 5);
  const targetBlocks = Math.max(1, Math.round(baseTargetBlocks * LISTING_DENSITY_SCALE * rowDensity));

  const canPlaceBlock = (startSeatIndex: number, blockSize: number): boolean => {
    const endSeatIndex = startSeatIndex + blockSize - 1;
    if (endSeatIndex > interiorEnd) return false;
    if (startSeatIndex > interiorStart && seats[startSeatIndex - 1]?.status === 'available') return false;
    if (endSeatIndex < interiorEnd && seats[endSeatIndex + 1]?.status === 'available') return false;

    for (let seatIndex = startSeatIndex; seatIndex <= endSeatIndex; seatIndex++) {
      if (seats[seatIndex]?.status === 'available') return false;
    }
    return true;
  };

  for (let blocksCreated = 0; blocksCreated < targetBlocks; blocksCreated++) {
    let blockSize = rng.randInt(minBlockSize, Math.max(minBlockSize + 1, maxBlockSize + 1));
    if (rng.random() < 0.35) {
      blockSize = Math.max(minBlockSize, Math.round(blockSize * (0.75 + (rng.random() * 0.7))));
    }
    let startOptions: number[] = [];

    while (blockSize >= minBlockSize && startOptions.length === 0) {
      for (let startSeatIndex = interiorStart; startSeatIndex <= interiorEnd - blockSize + 1; startSeatIndex++) {
        if (canPlaceBlock(startSeatIndex, blockSize)) {
          startOptions.push(startSeatIndex);
        }
      }
      if (startOptions.length === 0) blockSize -= 1;
    }

    if (startOptions.length === 0) break;

    const anchorBias = rng.random();
    const weightedOptions = anchorBias < 0.2
      ? startOptions.slice(0, Math.max(1, Math.ceil(startOptions.length * 0.4)))
      : anchorBias > 0.8
        ? startOptions.slice(Math.max(0, Math.floor(startOptions.length * 0.6)))
        : startOptions;
    const startSeatIndex = weightedOptions[rng.randInt(0, weightedOptions.length)]!;
    const listingId = nextListingId();
    for (let seatIndex = startSeatIndex; seatIndex < startSeatIndex + blockSize; seatIndex++) {
      seats[seatIndex] = {
        seatId: buildSeatFeatureId(sectionId, rowId, seatIndex + 1),
        status: 'available' as const,
        listingId,
      };
    }

    if (rng.random() < 0.18) {
      blocksCreated += 1;
    }
  }

  return seats;
}

function buildSectionInventory(
  sectionId: string,
  rowIds: string[],
  rowSeatCounts: Record<string, number>,
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
        seatId: buildSeatFeatureId(sectionId, rowId, si + 1),
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

    // Solo row (1% probability): each available seat is its own listing
    if (rng.random() < 0.01) {
      const seats: SeatData[] = Array.from({ length: seatCount }, (_, si) => {
        const isUnavailable = rng.random() < 0.93;
        const seatId = buildSeatFeatureId(sectionId, rowId, si + 1);
        if (isUnavailable) return { seatId, status: 'unavailable' as const };
        const listingId = `listing-${sectionId}-${rowId}-${listingCounter++}`;
        return { seatId, status: 'available' as const, listingId };
      });
      return { rowId, seats };
    }

    const seats = buildClusteredRowSeats(
      sectionId,
      rowId,
      seatCount,
      () => `listing-${sectionId}-${rowId}-${listingCounter++}`,
      rng,
    );

    return { rowId, seats };
  });

  return {
    sectionData: { sectionId, rows },
    unmappedListingIds,
  };
}

function applyDeterministicSectionScenario(
  scenario: DeterministicSectionScenario,
  sectionData: SectionData,
  rowSeatCounts: Record<string, number>,
): ListingGroupSpec[] {
  const sectionId = scenario.sectionId;
  const listingGroups: ListingGroupSpec[] = [];

  const replaceRowSeats = (rowId: string, listingId: string | null) => {
    const rowIndex = sectionData.rows.findIndex((row) => row.rowId === rowId);
    if (rowIndex < 0) return null;

    const seatCount = rowSeatCounts[rowId] ?? 0;
    const row = sectionData.rows[rowIndex]!;
    row.isZoneRow = false;
    row.seats = Array.from({ length: seatCount }, (_, seatIndex) => {
      const seatId = buildSeatFeatureId(sectionId, rowId, seatIndex + 1);
      if (!listingId) {
        return { seatId, status: 'unavailable' as const };
      }
      return {
        seatId,
        status: 'available' as const,
        listingId,
      };
    });

    return {
      rowIndex,
      rowNumber: rowIndex + 1,
      seatIds: row.seats.map((seat) => seat.seatId),
    };
  };

  const mixedRow = replaceRowSeats(scenario.mixedRowId, null);
  if (mixedRow) {
    listingGroups.push({
      listingId: `listing-${sectionId}-${scenario.mixedRowId}-row-unmapped-1`,
      rowId: scenario.mixedRowId,
      rowNumber: mixedRow.rowNumber,
      quantityAvailable: 2,
      seatIds: [],
      isUnmapped: true,
    });
    listingGroups.push({
      listingId: `listing-${sectionId}-${scenario.mixedRowId}-row-unmapped-2`,
      rowId: scenario.mixedRowId,
      rowNumber: mixedRow.rowNumber,
      quantityAvailable: 2,
      seatIds: [],
      isUnmapped: true,
    });
  }

  const mappedFullRowListingId = `listing-${sectionId}-${scenario.mappedFullRowId}-mapped-full-row`;
  const mappedRow = replaceRowSeats(scenario.mappedFullRowId, mappedFullRowListingId);
  if (mappedRow) {
    listingGroups.push({
      listingId: mappedFullRowListingId,
      rowId: scenario.mappedFullRowId,
      rowNumber: mappedRow.rowNumber,
      quantityAvailable: mappedRow.seatIds.length,
      seatIds: mappedRow.seatIds,
      isUnmapped: false,
    });
  }

  const backRow = replaceRowSeats(scenario.backRowId, null);
  if (backRow) {
    listingGroups.push({
      listingId: `listing-${sectionId}-${scenario.backRowId}-unmapped-full-row`,
      rowId: scenario.backRowId,
      rowNumber: backRow.rowNumber,
      quantityAvailable: backRow.seatIds.length,
      seatIds: [],
      isUnmapped: true,
    });
    listingGroups.push({
      listingId: `listing-${sectionId}-section-unmapped-1`,
      rowId: null,
      rowNumber: null,
      quantityAvailable: 2,
      seatIds: [],
      isUnmapped: true,
      bucketRowId: scenario.backRowId,
    });
    listingGroups.push({
      listingId: `listing-${sectionId}-section-unmapped-2`,
      rowId: null,
      rowNumber: null,
      quantityAvailable: 2,
      seatIds: [],
      isUnmapped: true,
      bucketRowId: scenario.backRowId,
    });
  }

  return listingGroups;
}

function createListingFromGroup(
  listingId: string,
  group: { rowId: string | null; rowNumber: number | null; seatIds: string[]; quantityAvailable: number },
  sectionId: string,
  numRows: number,
  rowSeatCounts: Record<string, number>,
  priceRange: [number, number],
  rng: ReturnType<typeof createSeededRandom>,
  isUnmapped: boolean,
): Listing {
  const price = rng.randInt(priceRange[0], priceRange[1] + 1);
  const feePerTicket = rng.randInt(800, 2500);
  const delivery = DELIVERY_OPTIONS[rng.randInt(0, 2)]!;

  const perks: Perk[] = [];
  if (group.rowNumber === 1) perks.push('front_of_section');
  if (group.rowId && isAisleListing({
    seatIds: group.seatIds,
    rowSeatCount: rowSeatCounts[group.rowId] ?? 0,
  })) perks.push('aisle');
  if (rng.random() < 0.10) perks.push('food_and_drink');

  const effectiveRowNumber = group.rowNumber ?? numRows;
  const posScore = numRows > 1 ? (1 - (effectiveRowNumber - 1) / (numRows - 1)) * 5 : 2.5;
  const priceScore = (1 - (price - priceRange[0]) / (priceRange[1] - priceRange[0])) * 4;
  const dealScore =
    Math.round(Math.max(0, Math.min(10, posScore + priceScore + DEAL_SCORE_BIAS + (rng.random() - 0.5))) * 10) / 10;

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
    quantityAvailable: group.quantityAvailable,
    feePerTicket,
    delivery,
  };
  if (isUnmapped) listing.isUnmapped = true;
  return listing;
}

function extractListings(
  sectionData: SectionData,
  sectionId: string,
  numRows: number,
  rowSeatCounts: Record<string, number>,
  priceRange: [number, number],
  unmappedListingIds: Set<string>,
  listingGroupSpecs: ListingGroupSpec[],
  rng: ReturnType<typeof createSeededRandom>,
): Listing[] {
  const groups = new Map<string, { rowId: string | null; rowNumber: number | null; seatIds: string[]; quantityAvailable: number }>();

  sectionData.rows.forEach((row, rowIndex) => {
    row.seats.forEach((seat) => {
      if (seat.status === 'unavailable' || !seat.listingId) return;
      const existing = groups.get(seat.listingId);
      if (existing) {
        existing.seatIds.push(seat.seatId);
        existing.quantityAvailable += 1;
      } else {
        groups.set(seat.listingId, {
          rowId: row.rowId,
          rowNumber: rowIndex + 1,
          seatIds: [seat.seatId],
          quantityAvailable: 1,
        });
      }
    });
  });

  for (const listing of listingGroupSpecs) {
    groups.set(listing.listingId, {
      rowId: listing.rowId,
      rowNumber: listing.rowNumber,
      seatIds: listing.seatIds,
      quantityAvailable: listing.quantityAvailable,
    });
    if (listing.isUnmapped) unmappedListingIds.add(listing.listingId);
  }

  const listings: Listing[] = [];
  groups.forEach((group, listingId) => {
    const isUnmapped = unmappedListingIds.has(listingId);
    listings.push(createListingFromGroup(
      listingId,
      group,
      sectionId,
      numRows,
      rowSeatCounts,
      priceRange,
      rng,
      isUnmapped,
    ));
  });

  return listings;
}

export function createManifestSeatMapModel(): SeatMapModel {
  const sectionIds = Object.keys(seatCounts).sort((a, b) => {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

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
    // Preserve original row ID casing to match GeoJSON feature IDs
    const rowSeatCounts = rawRowSeatCounts;
    // Sort row IDs numerically
    const rowIds = sortRowIds(rowSeatCounts);
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
      soldOutSections.has(sectionId),
      rng,
    );
    const deterministicScenario = resolveDeterministicSectionScenario(sectionId, rowIds);
    const listingGroupSpecs = deterministicScenario
      ? applyDeterministicSectionScenario(deterministicScenario, sectionData, rowSeatCounts)
      : [];
    sectionDataById.set(sectionId, sectionData);

    // Extract listings
    const priceSeed = hashString(`${SEED}-prices-${sectionId}`);
    const priceRng = createSeededRandom(priceSeed);
    const priceRange = getPriceRange(sectionId);
    const sectionListings = extractListings(
      sectionData,
      sectionId,
      numRows,
      rowSeatCounts,
      priceRange,
      unmappedListingIds,
      listingGroupSpecs,
      priceRng,
    );
    allListings.push(...sectionListings);

    // Pins: pick up to 3 per section from first-row listings
    if (sectionListings.length > 0) {
      const pinSeed = hashString(`${SEED}-pins-${sectionId}`);
      const pinRng = createSeededRandom(pinSeed);
      const candidates: PinData[] = sectionListings
        .filter((listing) => listing.rowNumber !== null)
        .map((listing) => ({
          listing,
          rowIndex: listing.rowNumber! - 1,
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
