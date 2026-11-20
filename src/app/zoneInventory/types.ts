/**
 * Zone-inventory prototype: types.
 *
 * The problem this models: on international football events some sellers send
 * listings with only a ZONE (a named group of sections) and no section at all.
 * Selecting a section on the map must never hide those zone-only listings.
 */

export type ZoneId =
  | 'longside-lower-central'
  | 'longside-upper-central'
  | 'shortside-lower'
  | 'shortside-upper'
  | 'vip';

export interface ZoneDef {
  id: ZoneId;
  name: string;
}

/**
 * One drawn shape on the map. Usually 1:1 with a section, but a section split
 * between two zones (AU4) is drawn as two shapes that share a `sectionLabel`.
 */
export interface SectionShape {
  /** Unique per shape — this is what the map selects on. */
  shapeId: string;
  /** What the buyer reads, e.g. "119" or "AU4". Not unique for split sections. */
  sectionLabel: string;
  zoneId: ZoneId;
  /** Ring in stadium units (x right, y down). Closed by the GeoJSON builder. */
  ring: Array<[number, number]>;
}

export interface Venue {
  shapes: SectionShape[];
  zones: ZoneDef[];
}

/** A listing as it arrives from a seller, after zone matching. */
export interface ZoneListing {
  listingId: string;
  /** Null when the seller gave no section ("zone-only" inventory). */
  shapeId: string | null;
  sectionLabel: string | null;
  /** Null when the seller's zone text matched nothing — never displayed. */
  zoneId: ZoneId | null;
  /** The raw seller zone string, kept so unmatched inventory is inspectable. */
  rawZone: string;
  /** Rows are unreliable: often "***", "N/A", "TBC", "TBD" or absent. */
  row: string | null;
  quantity: number;
  /** Cents, fees included. */
  price: number;
  /** 0–10, as in the base prototype. Badged on the card at >= 6. */
  dealScore: number;
}

/** Sort applies within each tier, never across them. */
export type SortBy = 'price' | 'dealScore';

export type Tier = 1 | 2;

/**
 * Headers split into a bolded count and an unbolded remainder, matching the
 * base prototype's listings header ("72 Listings" bold, "in Section 119" not).
 */
export interface HeaderText {
  count: string;
  detail: string | null;
}

export interface ListingGroup {
  tier: Tier;
  header: HeaderText;
  listings: ZoneListing[];
}

export interface PanelModel {
  /** Tier 1 — listings in the sections the buyer actually selected. */
  exact: ListingGroup | null;
  /** Tier 2 — the rest of every touched zone, in one group. */
  alsoInZone: ListingGroup | null;
  /** Flat list, used when nothing is selected. */
  all: ZoneListing[] | null;
  /** "58 listings" + "· 3 in Section 119" */
  resultsHeader: HeaderText;
  /** Set when Tier 1 is empty but the zone still has inventory. */
  totalVisible: number;
}

export interface Filters {
  /** Minimum quantity the listing must be able to satisfy. */
  quantity: number;
  /** Cents, inclusive. */
  priceMin: number;
  priceMax: number;
}
