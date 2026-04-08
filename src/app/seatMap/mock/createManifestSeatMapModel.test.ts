import { describe, expect, it } from 'vitest';
import venueSeatCounts from './venueSeatCounts.json';
import { createManifestSeatMapModel } from './createManifestSeatMapModel';
import { isAisleListing } from '../model/perks';

describe('createManifestSeatMapModel aisle perks', () => {
  it('derives aisle perks from row-edge seats', () => {
    const model = createManifestSeatMapModel();
    const rowSeatCounts = venueSeatCounts as Record<string, Record<string, number>>;

    const listingsWithAisle = model.listings.filter((listing) => listing.perks.includes('aisle'));
    const listingsWithoutAisle = model.listings.filter((listing) => !listing.perks.includes('aisle'));

    expect(listingsWithAisle.length).toBeGreaterThan(0);
    expect(listingsWithoutAisle.length).toBeGreaterThan(0);

    for (const listing of model.listings) {
      const expected = isAisleListing({
        seatIds: listing.seatIds,
        rowSeatCount: rowSeatCounts[listing.sectionId]?.[listing.rowId] ?? 0,
      });
      expect(listing.perks.includes('aisle')).toBe(expected);
    }
  });
});
