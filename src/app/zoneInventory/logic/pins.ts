import { SHAPES_BY_ZONE, ZONE_NAME, shapeCenter } from '../data/venue';
import type { Filters, ZoneId, ZoneListing } from '../types';
import { isDisplayable, passesFilters } from './visibility';

/**
 * One price pin. A pin stands for either a single section or a group of them —
 * a whole zone, or the part of a zone the buyer hasn't singled out — but always
 * hangs off a real section, because a zone's own centroid can land on the pitch
 * (VIP is VIP1 at one end, VIP2 at the other, and a corner of AU4).
 */
export interface ZonePin {
  /** Stable across renders so the map can reuse the marker. */
  key: string;
  /** The section the tail tip sits on. */
  anchorShapeId: string;
  price: number;
  /** What the pin is of; the map formats it into the aria-label with the price. */
  name: string;
  /** What clicking it selects. */
  target: { kind: 'shape'; shapeId: string } | { kind: 'zone'; zoneId: ZoneId };
}

export interface PinContext {
  /** Sections the buyer picked one at a time. */
  selectedShapeIds: string[];
  /** Zones under a chip pick or the pointer — these collapse to one pin. */
  collapsedZoneIds: ZoneId[];
  /** When set and inside a group, its price is what that group's pin shows. */
  selectedListingId: string | null;
}

/** The section of a zone closest to the zone's centre, used when nothing else anchors. */
function representativeShapeId(zoneId: ZoneId): string | null {
  const shapes = SHAPES_BY_ZONE.get(zoneId) ?? [];
  if (shapes.length === 0) return null;
  const centers = shapes.map((shape) => ({ shape, center: shapeCenter(shape) }));
  const cx = centers.reduce((a, c) => a + c.center[0], 0) / centers.length;
  const cy = centers.reduce((a, c) => a + c.center[1], 0) / centers.length;
  let best = centers[0]!;
  let bestDistance = Infinity;
  for (const candidate of centers) {
    const dx = candidate.center[0] - cx;
    const dy = candidate.center[1] - cy;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best.shape.shapeId;
}

/**
 * The price a grouped pin shows: the selected listing's, when the buyer has one
 * open inside the group, otherwise the cheapest the group has. Also reports
 * which listing that was, so the pin can hang off its section.
 */
function groupPrice(
  listings: ZoneListing[],
  selectedListingId: string | null,
): ZoneListing | null {
  if (listings.length === 0) return null;
  const selected = listings.find((l) => l.listingId === selectedListingId);
  if (selected) return selected;
  return listings.reduce((a, b) => (a.price <= b.price ? a : b));
}

/**
 * Price pins for the current selection.
 *
 * A section the buyer picked keeps its own pin. Everything else in a touched
 * zone collapses into a single pin, because a highlight that covers a region
 * wants one price for the region, not one per section inside it.
 */
export function buildPins(
  listings: ZoneListing[],
  filters: Filters,
  context: PinContext,
): ZonePin[] {
  const visible = listings.filter((l) => isDisplayable(l) && passesFilters(l, filters));
  const selected = new Set(context.selectedShapeIds);
  const collapsed = new Set(context.collapsedZoneIds);
  const pins: ZonePin[] = [];

  for (const [zoneId, shapes] of SHAPES_BY_ZONE) {
    const inZone = visible.filter((l) => l.zoneId === zoneId);
    const pickedHere = shapes.filter((shape) => selected.has(shape.shapeId));

    // A zone the pointer or a chip has claimed: one price for the whole thing.
    if (collapsed.has(zoneId)) {
      const winner = groupPrice(inZone, context.selectedListingId);
      // Hang it off the winning listing's own section when it has one; a
      // zone-only winner has none, so fall back to the zone's middle section.
      const anchor = winner?.shapeId ?? representativeShapeId(zoneId);
      if (winner && anchor) {
        pins.push({
          key: `zone:${zoneId}`,
          anchorShapeId: anchor,
          price: winner.price,
          name: ZONE_NAME[zoneId],
          target: { kind: 'zone', zoneId },
        });
      }
      continue;
    }

    if (pickedHere.length > 0) {
      // Each explicitly picked section keeps its own pin...
      for (const shape of pickedHere) {
        const here = inZone.filter((l) => l.shapeId === shape.shapeId);
        const winner = groupPrice(here, context.selectedListingId);
        if (!winner) continue;
        pins.push({
          key: `shape:${shape.shapeId}`,
          anchorShapeId: shape.shapeId,
          price: winner.price,
          name: `Section ${shape.sectionLabel}`,
          target: { kind: 'shape', shapeId: shape.shapeId },
        });
      }

      // ...and the rest of its zone collapses, mirroring the list's second tier.
      const rest = inZone.filter((l) => !l.shapeId || !selected.has(l.shapeId));
      const winner = groupPrice(rest, context.selectedListingId);
      const anchor = winner?.shapeId ?? representativeShapeId(zoneId);
      if (winner && anchor) {
        pins.push({
          key: `zone-rest:${zoneId}`,
          anchorShapeId: anchor,
          price: winner.price,
          name: `Elsewhere in ${ZONE_NAME[zoneId]}`,
          target: { kind: 'zone', zoneId },
        });
      }
      continue;
    }

    // Untouched zone: a pin per section that has section-level inventory.
    for (const shape of shapes) {
      const here = inZone.filter((l) => l.shapeId === shape.shapeId);
      const winner = groupPrice(here, context.selectedListingId);
      if (!winner) continue;
      pins.push({
        key: `shape:${shape.shapeId}`,
        anchorShapeId: shape.shapeId,
        price: winner.price,
        name: `Section ${shape.sectionLabel}`,
        target: { kind: 'shape', shapeId: shape.shapeId },
      });
    }
  }

  return pins;
}
