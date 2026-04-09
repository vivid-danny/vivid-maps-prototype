import { describe, expect, it } from 'vitest';
import type { Listing, PinData } from '../model/types';
import {
  declutterPins,
  getBestDealPinWithMinScoreFallback,
  splitSeatModePins,
} from './pins';

function createListing(overrides: Partial<Listing> = {}): Listing {
  return {
    listingId: overrides.listingId ?? 'listing-1',
    sectionId: overrides.sectionId ?? '101',
    sectionLabel: overrides.sectionLabel ?? '101',
    rowId: overrides.rowId ?? '1',
    rowNumber: overrides.rowNumber ?? 1,
    seatIds: overrides.seatIds ?? ['101:1:s1'],
    price: overrides.price ?? 10000,
    seatViewUrl: overrides.seatViewUrl ?? 'seat-view.png',
    perks: overrides.perks ?? [],
    dealScore: overrides.dealScore ?? 5,
    quantityAvailable: overrides.quantityAvailable ?? 1,
    feePerTicket: overrides.feePerTicket ?? 1000,
    delivery: overrides.delivery ?? {
      method: 'mobile_transfer',
      label: 'Mobile transfer',
      description: 'Transferred to your phone',
    },
    isUnmapped: overrides.isUnmapped,
  };
}

function createPinData(listing: Listing): PinData {
  return {
    listing,
    rowIndex: (listing.rowNumber ?? 1) - 1,
    seatIndex: Math.floor(listing.seatIds.length / 2),
  };
}

function createResolvedPin(
  listing: Listing,
  x: number,
  y: number,
  sectionId = listing.sectionId,
) {
  return {
    pin: createPinData(listing),
    x,
    y,
    sectionId,
  };
}

describe('getBestDealPinWithMinScoreFallback', () => {
  it('returns the highest scoring qualifying pin when one exists', () => {
    const low = createPinData(createListing({ listingId: 'low', dealScore: 4.8, price: 9000 }));
    const qualifying = createPinData(createListing({ listingId: 'qualifying', dealScore: 5.4, price: 12000 }));
    const best = createPinData(createListing({ listingId: 'best', dealScore: 7.2, price: 15000 }));

    expect(getBestDealPinWithMinScoreFallback([low, qualifying, best])?.listing.listingId).toBe('best');
  });

  it('falls back to the best available pin when all scores are below the threshold', () => {
    const first = createPinData(createListing({ listingId: 'first', dealScore: 4.2, price: 9000 }));
    const fallback = createPinData(createListing({ listingId: 'fallback', dealScore: 4.9, price: 14000 }));

    expect(getBestDealPinWithMinScoreFallback([first, fallback])?.listing.listingId).toBe('fallback');
  });

  it('breaks equal-score ties by lower price', () => {
    const pricier = createPinData(createListing({ listingId: 'pricier', dealScore: 6.1, price: 15000 }));
    const cheaper = createPinData(createListing({ listingId: 'cheaper', dealScore: 6.1, price: 12000 }));

    expect(getBestDealPinWithMinScoreFallback([pricier, cheaper])?.listing.listingId).toBe('cheaper');
  });
});

describe('declutterPins', () => {
  it('removes nearby lower-priority seat pins when density is tightened', () => {
    const best = createResolvedPin(createListing({ listingId: 'best', dealScore: 7.8, price: 12000 }), 0, 0);
    const nearby = createResolvedPin(createListing({ listingId: 'nearby', dealScore: 5.6, price: 9000 }), 0.00005, 0);
    const far = createResolvedPin(createListing({ listingId: 'far', dealScore: 6.9, price: 11000 }), 0.004, 0);

    const placed = declutterPins([nearby, far, best], 'seats', 0.06, false, {
      sections: 0.0015,
      rows: 0.0015,
      seats: 0.00018,
    });

    expect(placed.map((pin) => pin.pin.listing.listingId)).toEqual(['best', 'far']);
  });

  it('keeps the best-deal listing when nearby seat pins compete', () => {
    const bestDeal = createResolvedPin(createListing({ listingId: 'best-deal', dealScore: 8.1, price: 13000 }), 0, 0);
    const cheaper = createResolvedPin(createListing({ listingId: 'cheaper', dealScore: 6.2, price: 9000 }), 0.00003, 0);

    const placed = declutterPins([cheaper, bestDeal], 'seats', 0.06, false, {
      sections: 0.0015,
      rows: 0.0015,
      seats: 0.00018,
    });

    expect(placed.map((pin) => pin.pin.listing.listingId)).toEqual(['best-deal']);
  });
});

describe('splitSeatModePins', () => {
  it('uses sparse venue-wide seat pins when there is no selected section', () => {
    const a = createResolvedPin(createListing({ listingId: 'a', sectionId: '101', dealScore: 7.2 }), 0, 0);
    const b = createResolvedPin(createListing({ listingId: 'b', sectionId: '102', dealScore: 6.1 }), 0.00003, 0);
    const c = createResolvedPin(createListing({ listingId: 'c', sectionId: '103', dealScore: 5.4 }), 0.004, 0);

    const placed = splitSeatModePins([a, b, c], null, 0.06, false, {
      sections: 0.0015,
      rows: 0.0015,
      seats: 0.00018,
    });

    expect(placed.map((pin) => pin.pin.listing.listingId)).toEqual(['a', 'c']);
  });

  it('keeps all active-section pins while thinning background sections', () => {
    const activeA = createResolvedPin(createListing({ listingId: 'active-a', sectionId: '101', dealScore: 7.0 }), 0, 0, '101');
    const activeB = createResolvedPin(createListing({ listingId: 'active-b', sectionId: '101', dealScore: 6.4 }), 0.00003, 0, '101');
    const bgA = createResolvedPin(createListing({ listingId: 'bg-a', sectionId: '201', dealScore: 7.5 }), 0.01, 0, '201');
    const bgB = createResolvedPin(createListing({ listingId: 'bg-b', sectionId: '202', dealScore: 5.7 }), 0.01003, 0, '202');
    const bgFar = createResolvedPin(createListing({ listingId: 'bg-far', sectionId: '203', dealScore: 6.2 }), 0.02, 0, '203');

    const placed = splitSeatModePins([activeA, activeB, bgA, bgB, bgFar], '101', 0.06, false, {
      sections: 0.0015,
      rows: 0.0015,
      seats: 0.00018,
    });

    expect(placed.map((pin) => pin.pin.listing.listingId)).toEqual(['bg-a', 'bg-far', 'active-a', 'active-b']);
  });
});
