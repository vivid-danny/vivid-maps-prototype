export type DisplayMode = 'seats' | 'rows' | 'sections';

export type LayoutMode = 'desktop' | 'mobile';

export interface SeatColors {
  available: string;
  unavailable: string;
  hover: string;
  pressed: string;
  selected: string;
  connector: string;
  labelDefault: string;
  labelSelected: string;
  labelUnavailable: string;
}

export interface SeatData {
  seatId: string;
  status: 'available' | 'unavailable';
  listingId?: string;
}

export interface RowData {
  rowId: string;
  seats: SeatData[];
}

export interface SectionData {
  sectionId: string;
  rows: RowData[];
}

// Configuration types for generating sections and maps

export interface SectionConfig {
  sectionId: string;
  label: string; // Display label (e.g., "101", "Pit", "Orchestra")
  numRows: number;
  seatsPerRow: number;
  x: number;
  y: number;
  // Optional: control how many seats are unavailable (0.0 to 1.0)
  unavailableRatio?: number;
  // Optional: control how many listings (seat groups) to generate
  listingCount?: number;
  // Optional: range for seats per listing [min, max]
  seatsPerListing?: [number, number];
  // Optional: array of 1-indexed row numbers that are fully sold out
  soldOutRows?: number[];
}

export interface BoundaryConfig {
  path: string;           // SVG path d attribute
  viewBox: string;        // e.g., "0 0 306 304"
  width: number;          // Container width in pixels
  height: number;         // Container height in pixels
  fill?: string;          // Default: "white"
  stroke?: string;        // Default: "#A0A2B3"
  strokeWidth?: number;   // Default: 2
}

export interface MapConfig {
  id: string;
  name: string;
  sections: SectionConfig[];
  seed: number;
  boundary?: BoundaryConfig;
}

export interface SeatMapModel extends MapConfig {
  sectionDataById: Map<string, SectionData>;
  listings: Listing[];
  listingsBySection: Map<string, Listing[]>;
  pinsBySection: Map<string, PinData[]>;
}

// Unified selection state - only one thing can be selected at a time
// Selecting at a finer level (seat) auto-selects ancestors (row, section)
export interface SelectionState {
  sectionId: string | null;  // Set whenever anything is selected
  rowId: string | null;      // Set when row or seat is selected
  listingId: string | null;  // Set when a listing/seat is selected
  seatIds: string[];         // The actual seat IDs (for multi-seat listings)
}

export const EMPTY_SELECTION: SelectionState = {
  sectionId: null,
  rowId: null,
  listingId: null,
  seatIds: [],
};

// Hover state for bidirectional hover between listings panel and map
// With unified listingId on all seats, we only need listingId for hover matching
export interface HoverState {
  listingId: string | null;  // The listing being hovered (from panel or map)
  sectionId: string | null;  // For section-level hover
  rowId: string | null;      // For row-level hover
}

export const EMPTY_HOVER: HoverState = {
  listingId: null,
  sectionId: null,
  rowId: null,
};

export interface PinData {
  listing: Listing;
  rowIndex: number;   // 0-based row index within section
  seatIndex: number;  // 0-based seat index within row
}

export type Perk = 'aisle' | 'front_of_section' | 'ada_accessible' | 'food_and_drink' | 'super_seller' | 'vip';

// Listing data for the listings panel
export interface Listing {
  listingId: string;
  sectionId: string;
  sectionLabel: string;
  rowId: string;
  rowNumber: number;
  seatIds: string[];
  price: number; // in cents for precision
  seatViewUrl: string;
  perks: Perk[];
  dealScore: number; // 0-10.0 scale
}
