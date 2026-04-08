import { describe, expect, it } from 'vitest';
import type { Listing, PinData } from '../model/types';
import { getBestDealPinWithMinScoreFallback } from './pins';

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
    rowIndex: listing.rowNumber - 1,
    seatIndex: Math.floor(listing.seatIds.length / 2),
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
