import { describe, expect, it } from 'vitest';
import { buildConnectorFeatures } from './useListingConnectors';
import type { DeliveryInfo, Listing } from '../model/types';

const DELIVERY: DeliveryInfo = {
  method: 'mobile_transfer',
  label: 'Mobile Transfer',
  description: 'Transfer',
};

function createListing(overrides: Pick<Listing, 'listingId' | 'sectionId' | 'seatIds'> & Partial<Listing>): Listing {
  return {
    sectionLabel: overrides.sectionLabel ?? 'Section',
    rowId: overrides.rowId ?? 'R1',
    rowNumber: overrides.rowNumber ?? 1,
    price: overrides.price ?? 10000,
    seatViewUrl: overrides.seatViewUrl ?? 'seat-view.png',
    perks: overrides.perks ?? [],
    dealScore: overrides.dealScore ?? 5,
    quantityAvailable: overrides.quantityAvailable ?? 2,
    feePerTicket: overrides.feePerTicket ?? 1000,
    delivery: overrides.delivery ?? DELIVERY,
    ...overrides,
  };
}

describe('buildConnectorFeatures()', () => {
  it('should build a LineString per listing with 2+ resolvable seat coordinates', () => {
    const listings = [
      createListing({ listingId: 'L1', sectionId: 'S1', rowId: 'R1', seatIds: ['s1', 's2'] }),
    ];
    const coords = new Map<string, [number, number]>([
      ['s1', [0, 0]],
      ['s2', [1, 1]],
    ]);

    const features = buildConnectorFeatures(listings, coords);

    expect(features).toHaveLength(1);
    expect(features[0].geometry.type).toBe('LineString');
    expect(features[0].geometry.coordinates).toEqual([[0, 0], [1, 1]]);
    expect(features[0].properties).toMatchObject({
      listingId: 'L1',
      sectionId: 'S1',
      rowId: 'R1',
    });
  });

  it('should skip listings with fewer than 2 seats', () => {
    const listings = [createListing({ listingId: 'L1', sectionId: 'S1', seatIds: ['s1'] })];
    const coords = new Map<string, [number, number]>([['s1', [0, 0]]]);

    expect(buildConnectorFeatures(listings, coords)).toHaveLength(0);
  });

  it('should skip listings whose seats have fewer than 2 resolvable coordinates', () => {
    const listings = [createListing({ listingId: 'L1', sectionId: 'S1', seatIds: ['s1', 's2'] })];
    const coords = new Map<string, [number, number]>([['s1', [0, 0]]]);

    expect(buildConnectorFeatures(listings, coords)).toHaveLength(0);
  });
});
