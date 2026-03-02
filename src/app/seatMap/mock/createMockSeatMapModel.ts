import { generateAllListings } from './generateListings';
import { generateAllPins } from './generatePins';
import { generateSectionData } from './generateSectionData';
import type { MapConfig, SeatMapModel, EventInfo } from '../model/types';

// Layout constants for centered positioning.
// Section widths: narrow (6 seats) = 36px, wide (14 seats) = 84px.
const SECTION_X = {
  col1: 35,
  col2: 81,
  col3: 175,
  col4: 269,
};

// Stage configuration - centered over sections, preserving aspect ratio (131:125).
export const STAGE_CONFIG = {
  x: 120,
  y: 25,
  width: 100,
  height: 95,
};

const DEMO_MAP: MapConfig = {
  id: 'demo',
  name: 'Demo Venue',
  boundary: {
    path: 'M228.243 1.00006L305 141.199V267.98L280.194 267.887L228.243 303L77.7568 303L25.806 267.887L1 267.98V141.199L77.7568 1L228.243 1.00006Z',
    viewBox: '0 0 306 304',
    width: 340,
    height: 340,
  },
  sections: [
    {
      sectionId: 'H',
      label: '101',
      numRows: 10,
      seatsPerRow: 6,
      x: SECTION_X.col1,
      y: 140,
      unavailableRatio: 1.0,
      listingCount: 0,
    },
    {
      sectionId: 'B',
      label: '102',
      numRows: 9,
      seatsPerRow: 14,
      x: SECTION_X.col2,
      y: 165,
      unavailableRatio: 0.5,
      listingCount: 20,
      seatsPerListing: [2, 8],
      seatSaverRows: [3, 7],
    },
    {
      sectionId: 'C',
      label: '103',
      numRows: 9,
      seatsPerRow: 14,
      x: SECTION_X.col3,
      y: 165,
      unavailableRatio: 0.5,
      listingCount: 20,
      seatsPerListing: [2, 8],
    },
    {
      sectionId: 'D',
      label: '104',
      numRows: 10,
      seatsPerRow: 6,
      x: SECTION_X.col4,
      y: 140,
      unavailableRatio: 1.0,
      listingCount: 0,
    },
    {
      sectionId: 'E',
      label: '1B',
      numRows: 10,
      seatsPerRow: 6,
      x: SECTION_X.col1,
      y: 215,
      unavailableRatio: 0.5,
      listingCount: 12,
      seatsPerListing: [2, 6],
      seatSaverRows: [2, 6],
    },
    {
      sectionId: 'F',
      label: '2B',
      numRows: 9,
      seatsPerRow: 14,
      x: SECTION_X.col2,
      y: 235,
      unavailableRatio: 0.5,
      listingCount: 18,
      seatsPerListing: [2, 8],
      soldOutRows: [3, 4, 5],
    },
    {
      sectionId: 'G',
      label: '3B',
      numRows: 9,
      seatsPerRow: 14,
      x: SECTION_X.col3,
      y: 235,
      unavailableRatio: 0.5,
      listingCount: 20,
      seatsPerListing: [2, 8],
    },
    {
      sectionId: 'A',
      label: '4B',
      numRows: 10,
      seatsPerRow: 6,
      x: SECTION_X.col4,
      y: 215,
      unavailableRatio: 0.5,
      listingCount: 12,
      seatsPerListing: [2, 6],
    },
  ],
  seed: 12345,
};

const DEMO_EVENT_INFO: EventInfo = {
  eventName: 'Lionel Richie and Earth Wind and Fire',
  eventDate: 'Tue, Jan 30, 2024 at 7:00pm',
  venueName: 'Wrigley Field',
  venueAddress: '1060 W Addison St, Chicago, IL 60613',
};

interface CreateMockSeatMapModelOptions {
  seed?: number;
}

export function createMockSeatMapModel(options: CreateMockSeatMapModelOptions = {}): SeatMapModel {
  const seed = options.seed ?? DEMO_MAP.seed;
  const mapConfig: MapConfig = { ...DEMO_MAP, seed };

  const sectionDataById = new Map(
    mapConfig.sections.map((sectionConfig) => [
      sectionConfig.sectionId,
      generateSectionData(sectionConfig, seed),
    ])
  );

  const listings = generateAllListings(mapConfig.sections, seed);
  const pinsBySection = generateAllPins(listings, mapConfig.sections, seed);

  const listingsBySection = new Map<string, typeof listings>();
  for (const listing of listings) {
    const existing = listingsBySection.get(listing.sectionId);
    if (existing) {
      existing.push(listing);
    } else {
      listingsBySection.set(listing.sectionId, [listing]);
    }
  }

  return {
    ...mapConfig,
    sectionDataById,
    listings,
    listingsBySection,
    pinsBySection,
    eventInfo: DEMO_EVENT_INFO,
  };
}

