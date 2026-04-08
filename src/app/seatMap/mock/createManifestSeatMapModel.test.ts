import { describe, expect, it } from 'vitest';
import venueSeatCounts from './venueSeatCounts.json';
import { createManifestSeatMapModel } from './createManifestSeatMapModel';
import { isAisleListing } from '../model/perks';
import { buildRowFeatureId } from '../model/ids';

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

describe('createManifestSeatMapModel mixed row scenarios', () => {
  it('includes deterministic mixed mapped and unmapped demo rows', () => {
    const model = createManifestSeatMapModel();

    const mixedMiddleMapped = model.listings.find((listing) => listing.listingId === 'listing-214-5-mapped-demo');
    const mixedMiddleUnmapped = model.listings.find((listing) => listing.listingId === 'listing-214-5-unmapped-demo');
    const mixedEdgeMapped = model.listings.find((listing) => listing.listingId === 'listing-316-12-mapped-demo');
    const mixedEdgeUnmapped = model.listings.find((listing) => listing.listingId === 'listing-316-12-unmapped-demo');
    const unmappedOnly = model.listings.find((listing) => listing.listingId === 'listing-24-13-unmapped-demo');

    expect(mixedMiddleMapped?.seatIds).toEqual(['214:5:s4', '214:5:s5']);
    expect(mixedMiddleMapped?.isUnmapped).toBeUndefined();
    expect(mixedMiddleUnmapped?.seatIds).toEqual([]);
    expect(mixedMiddleUnmapped?.isUnmapped).toBe(true);
    expect(mixedMiddleUnmapped?.quantityAvailable).toBe(2);

    expect(mixedEdgeMapped?.seatIds).toEqual(['316:12:s1', '316:12:s2']);
    expect(mixedEdgeUnmapped?.seatIds).toEqual([]);
    expect(mixedEdgeUnmapped?.isUnmapped).toBe(true);

    expect(unmappedOnly?.seatIds).toEqual([]);
    expect(unmappedOnly?.isUnmapped).toBe(true);
    expect(unmappedOnly?.quantityAvailable).toBe(4);

    const rowsWithListings = new Set(model.listings.map((listing) => buildRowFeatureId(listing.sectionId, listing.rowId)));
    expect(rowsWithListings.has(buildRowFeatureId('214', '5'))).toBe(true);
    expect(rowsWithListings.has(buildRowFeatureId('316', '12'))).toBe(true);
    expect(rowsWithListings.has(buildRowFeatureId('24', '13'))).toBe(true);
  });
});

describe('createManifestSeatMapModel listing quantity mix', () => {
  it('skews mapped listings toward larger ticket quantities over singles', () => {
    const model = createManifestSeatMapModel();
    const mappedListings = model.listings.filter((listing) => listing.seatIds.length > 0);
    const singleTicketListings = mappedListings.filter((listing) => listing.quantityAvailable === 1);
    const largerGroupListings = mappedListings.filter((listing) => listing.quantityAvailable >= 4);

    expect(largerGroupListings.length).toBeGreaterThan(singleTicketListings.length);
  });
});
