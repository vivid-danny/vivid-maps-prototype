import { describe, expect, it } from 'vitest';
import venueSeatCounts from './venueSeatCounts.json';
import { createManifestSeatMapModel } from './createManifestSeatMapModel';
import { isAisleListing } from '../model/perks';
import { buildRowFeatureId } from '../model/ids';

function sortRowIds(rowSeatCounts: Record<string, number>): string[] {
  return Object.keys(rowSeatCounts).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

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
        rowSeatCount: listing.rowId ? (rowSeatCounts[listing.sectionId]?.[listing.rowId] ?? 0) : 0,
      });
      expect(listing.perks.includes('aisle')).toBe(expected);
    }
  });
});

describe('createManifestSeatMapModel mixed row scenarios', () => {
  it('includes deterministic mapped, row-unmapped, and section-unmapped scenarios', () => {
    const model = createManifestSeatMapModel();
    const rowSeatCounts = venueSeatCounts as Record<string, Record<string, number>>;
    const scenarioSections = [
      { sectionId: '214', mixedRowId: '5' },
      { sectionId: '316', mixedRowId: '12' },
      { sectionId: '24', mixedRowId: '13' },
    ] as const;

    const rowsWithListings = new Set(
      model.listings
        .filter((listing) => listing.rowId !== null)
        .map((listing) => buildRowFeatureId(listing.sectionId, listing.rowId!)),
    );

    for (const { sectionId, mixedRowId } of scenarioSections) {
      const rowIds = sortRowIds(rowSeatCounts[sectionId]!);
      const backRowId = rowIds[rowIds.length - 1]!;
      const mappedFullRowId = rowIds.find((rowId) => rowId !== mixedRowId && rowId !== backRowId)!;
      const mixedMappedRowId = rowIds.find((rowId) => rowId !== mixedRowId && rowId !== mappedFullRowId && rowId !== backRowId)!;
      const deterministicListings = model.listings.filter((listing) =>
        listing.sectionId === sectionId
        && (
          listing.listingId.includes('-row-unmapped-')
          || listing.listingId.includes('-mapped-full-row')
          || listing.listingId.includes('-mapped-priority-demo')
          || listing.listingId.includes('-unmapped-full-row')
          || listing.listingId.includes('-section-unmapped-')
        ),
      );
      const mappedFullRow = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${mappedFullRowId}-mapped-full-row`);
      const mappedPriorityRow = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${mixedMappedRowId}-mapped-priority-demo`);
      const mappedPriorityOverflow = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${mixedMappedRowId}-mapped-row-unmapped-1`);
      const unmappedFullRow = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${backRowId}-unmapped-full-row`);
      const rowUnmapped1 = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${mixedRowId}-row-unmapped-1`);
      const rowUnmapped2 = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-${mixedRowId}-row-unmapped-2`);
      const sectionUnmapped1 = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-section-unmapped-1`);
      const sectionUnmapped2 = model.listings.find((listing) => listing.listingId === `listing-${sectionId}-section-unmapped-2`);

      expect(deterministicListings).toHaveLength(8);

      expect(rowUnmapped1?.seatIds).toEqual([]);
      expect(rowUnmapped1?.rowId).toBe(mixedRowId);
      expect(rowUnmapped1?.isUnmapped).toBe(true);
      expect(rowUnmapped1?.quantityAvailable).toBe(2);
      expect(rowUnmapped2?.seatIds).toEqual([]);
      expect(rowUnmapped2?.rowId).toBe(mixedRowId);
      expect(rowUnmapped2?.isUnmapped).toBe(true);
      expect(rowUnmapped2?.quantityAvailable).toBe(2);

      expect(sectionUnmapped1?.seatIds).toEqual([]);
      expect(sectionUnmapped1?.rowId).toBeNull();
      expect(sectionUnmapped1?.rowNumber).toBeNull();
      expect(sectionUnmapped1?.isUnmapped).toBe(true);
      expect(sectionUnmapped2?.seatIds).toEqual([]);
      expect(sectionUnmapped2?.rowId).toBeNull();
      expect(sectionUnmapped2?.rowNumber).toBeNull();
      expect(sectionUnmapped2?.isUnmapped).toBe(true);

      expect(unmappedFullRow?.seatIds).toEqual([]);
      expect(unmappedFullRow?.rowId).toBe(backRowId);
      expect(unmappedFullRow?.isUnmapped).toBe(true);
      expect(unmappedFullRow?.quantityAvailable).toBe(rowSeatCounts[sectionId]?.[backRowId]);

      expect(mappedFullRow?.rowId).toBe(mappedFullRowId);
      expect(mappedFullRow?.rowNumber).not.toBeNull();
      expect(mappedFullRow?.isUnmapped).toBeUndefined();
      expect(mappedFullRow?.seatIds).toEqual(
        Array.from(
          { length: rowSeatCounts[sectionId]?.[mappedFullRowId] ?? 0 },
          (_, seatIndex) => `${sectionId}:${mappedFullRowId}:s${seatIndex + 1}`,
        ),
      );

      expect(mappedPriorityRow?.rowId).toBe(mixedMappedRowId);
      expect(mappedPriorityRow?.rowNumber).not.toBeNull();
      expect(mappedPriorityRow?.isUnmapped).toBeUndefined();
      expect(mappedPriorityRow?.seatIds).toEqual(
        Array.from(
          { length: Math.min(2, rowSeatCounts[sectionId]?.[mixedMappedRowId] ?? 0) },
          (_, seatIndex) => `${sectionId}:${mixedMappedRowId}:s${seatIndex + 1}`,
        ),
      );

      expect(mappedPriorityOverflow?.seatIds).toEqual([]);
      expect(mappedPriorityOverflow?.rowId).toBe(mixedMappedRowId);
      expect(mappedPriorityOverflow?.rowNumber).toBe(mappedPriorityRow?.rowNumber);
      expect(mappedPriorityOverflow?.isUnmapped).toBe(true);
      expect(mappedPriorityOverflow?.quantityAvailable).toBe(2);

      expect(rowsWithListings.has(buildRowFeatureId(sectionId, mixedRowId))).toBe(true);
      expect(rowsWithListings.has(buildRowFeatureId(sectionId, mappedFullRowId))).toBe(true);
      expect(rowsWithListings.has(buildRowFeatureId(sectionId, mixedMappedRowId))).toBe(true);
      expect(rowsWithListings.has(buildRowFeatureId(sectionId, backRowId))).toBe(true);
      const pinListings = model.pinsBySection.get(sectionId) ?? [];
      expect(pinListings.some((pin) => pin.listing.rowId === null)).toBe(false);
    }
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
