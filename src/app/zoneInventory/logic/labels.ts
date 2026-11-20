import { ZONE_NAME } from '../data/venue';
import type { ZoneListing } from '../types';

/**
 * A listing's location, widest part first: "Longside Upper Central, Section 219".
 *
 * Every part is optional except the zone — `isDisplayable` drops anything whose
 * seller zone text matched nothing, so a rendered listing always has one. A
 * missing section is simply left out rather than labelled as missing.
 *
 * Shared so the list row and the detail panel can't drift apart.
 */
export function listingTitle(listing: ZoneListing): string {
  const zoneName = listing.zoneId ? ZONE_NAME[listing.zoneId] : null;
  const section = listing.sectionLabel === null ? null : `Section ${listing.sectionLabel}`;
  return [zoneName, section].filter(Boolean).join(', ');
}
