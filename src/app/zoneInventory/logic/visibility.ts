import { SHAPE_BY_ID, SHAPES_BY_ZONE, ZONE_NAME } from '../data/venue';
import type {
  Filters,
  HeaderText,
  ListingGroup,
  PanelModel,
  SortBy,
  ZoneId,
  ZoneListing,
} from '../types';

/**
 * The visibility rule, in one place.
 *
 * With one or more sections selected, every listing lands in a tier:
 *
 *   section selected, zone of a selected section   → Tier 1
 *   no section,       zone of a selected section   → Tier 2
 *   other section,    zone of a selected section   → Tier 2
 *   anything,         zone holds no selection      → hidden
 *   no matched zone                                → hidden, always
 *
 * With nothing selected, every zone-matched listing shows in one flat list.
 */

export const PLACEHOLDER_ROWS = new Set(['***', 'N/A', 'NA', 'TBC', 'TBD', '-', '']);

/** Rows are unreliable on this inventory; a placeholder should never render. */
export function displayRow(row: string | null): string | null {
  if (!row) return null;
  return PLACEHOLDER_ROWS.has(row.trim().toUpperCase()) ? null : row;
}

/** A listing that cannot be matched to a zone is never shown, selection or not. */
export function isDisplayable(listing: ZoneListing): boolean {
  return listing.zoneId !== null;
}

export function passesFilters(listing: ZoneListing, filters: Filters): boolean {
  return (
    listing.quantity >= filters.quantity
    && listing.price >= filters.priceMin
    && listing.price <= filters.priceMax
  );
}

/**
 * Sort runs inside a tier, never across tiers. Tier order is a relevance
 * statement — the section the buyer picked comes first — so letting a sort
 * interleave the groups would bury that section's own inventory.
 */
function comparator(sortBy: SortBy) {
  if (sortBy === 'dealScore') {
    // Equal scores fall back to price so the order is stable and sensible.
    return (a: ZoneListing, b: ZoneListing) =>
      b.dealScore - a.dealScore || a.price - b.price;
  }
  return (a: ZoneListing, b: ZoneListing) => a.price - b.price;
}

/** Section labels of the selection, deduped (a split section selects once). */
export function selectedSectionLabels(selectedShapeIds: string[]): string[] {
  const labels: string[] = [];
  for (const shapeId of selectedShapeIds) {
    const label = SHAPE_BY_ID.get(shapeId)?.sectionLabel;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function formatSectionList(labels: string[]): string {
  if (labels.length === 0) return '';
  return labels.length === 1 ? `Section ${labels[0]}` : `Sections ${labels.join(', ')}`;
}

function plural(n: number): string {
  return `${n} ${n === 1 ? 'listing' : 'listings'}`;
}

/** Zones that contain at least one selected section. */
export function selectedZoneIds(selectedShapeIds: string[]): ZoneId[] {
  const zones: ZoneId[] = [];
  for (const shapeId of selectedShapeIds) {
    const zoneId = SHAPE_BY_ID.get(shapeId)?.zoneId;
    if (zoneId && !zones.includes(zoneId)) zones.push(zoneId);
  }
  return zones;
}

/**
 * Shapes that should be lightly tinted: everything else in every touched zone.
 * Zones can be non-contiguous, so this can span opposite ends of the plan.
 */
export function zoneSiblingShapeIds(selectedShapeIds: string[]): string[] {
  const selected = new Set(selectedShapeIds);
  const siblings: string[] = [];
  for (const zoneId of selectedZoneIds(selectedShapeIds)) {
    for (const shape of SHAPES_BY_ZONE.get(zoneId) ?? []) {
      if (!selected.has(shape.shapeId)) siblings.push(shape.shapeId);
    }
  }
  return siblings;
}

export function buildPanelModel(
  listings: ZoneListing[],
  selectedShapeIds: string[],
  filters: Filters,
  sortBy: SortBy = 'price',
): PanelModel {
  const visible = listings.filter((l) => isDisplayable(l) && passesFilters(l, filters));
  const byRank = comparator(sortBy);

  if (selectedShapeIds.length === 0) {
    const all = [...visible].sort(byRank);
    return {
      exact: null,
      alsoInZone: null,
      all,
      resultsHeader: { count: plural(all.length), detail: null },
      totalVisible: all.length,
    };
  }

  const selected = new Set(selectedShapeIds);
  const zones = selectedZoneIds(selectedShapeIds);
  const zoneSet = new Set(zones);

  const tier1: ZoneListing[] = [];
  const tier2: ZoneListing[] = [];
  for (const listing of visible) {
    if (listing.shapeId && selected.has(listing.shapeId)) tier1.push(listing);
    else if (listing.zoneId && zoneSet.has(listing.zoneId)) tier2.push(listing);
  }
  tier1.sort(byRank);
  tier2.sort(byRank);

  const labels = selectedSectionLabels(selectedShapeIds);
  const sectionList = formatSectionList(labels);

  /*
   * Tier 1's header IS the results header — the panel renders Tier 1's cards
   * directly rather than heading them twice. Both read "4 listings in Section
   * 120": the same shape the zone group below uses, so the two tiers are
   * directly comparable instead of one being a fraction of the other.
   */
  const exactHeader: HeaderText = { count: plural(tier1.length), detail: `in ${sectionList}` };
  const exact: ListingGroup | null = tier1.length > 0
    ? { tier: 1, header: exactHeader, listings: tier1 }
    : null;

  const zoneDetail = zones.length === 1 ? `in ${ZONE_NAME[zones[0]!]}` : 'in these zones';
  const alsoInZone: ListingGroup | null = tier2.length > 0
    ? { tier: 2, header: { count: plural(tier2.length), detail: zoneDetail }, listings: tier2 }
    : null;

  const total = tier1.length + tier2.length;

  return {
    exact,
    alsoInZone,
    all: null,
    resultsHeader: exactHeader,
    totalVisible: total,
  };
}

/**
 * Lowest price per section shape, for the map pins. Zone-only listings have no
 * section, so they can never contribute to a pin — a section with no exact
 * listings simply has no pin, and stays selectable.
 */
export function lowestPriceByShape(
  listings: ZoneListing[],
  filters: Filters,
): Map<string, number> {
  const lowest = new Map<string, number>();
  for (const listing of listings) {
    if (!listing.shapeId || !isDisplayable(listing)) continue;
    if (!passesFilters(listing, filters)) continue;
    const current = lowest.get(listing.shapeId);
    if (current === undefined || listing.price < current) {
      lowest.set(listing.shapeId, listing.price);
    }
  }
  return lowest;
}
