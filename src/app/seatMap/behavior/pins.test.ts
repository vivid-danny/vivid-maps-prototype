import { describe, expect, it } from 'vitest';
import {
  getHoverPinTarget,
  getOverlayPinVisualState,
  isPinVisible,
} from './pins';
import type { DisplayMode, HoverState, Listing, PinData } from '../model/types';

function createListing(overrides: Partial<Listing> = {}): Listing {
  return {
    listingId: 'listing-A-1',
    sectionId: 'A',
    sectionLabel: 'A',
    rowId: 'A1',
    rowNumber: 1,
    seatIds: ['A1-1'],
    price: 10000,
    seatViewUrl: 'https://example.com/seat.jpg',
    perks: [],
    dealScore: 7.5,
    ...overrides,
  };
}

function createPin(overrides: Partial<PinData> = {}): PinData {
  const listing = createListing();
  return {
    listing,
    rowIndex: 0,
    seatIndex: 0,
    ...overrides,
  };
}

function createHover(overrides: Partial<HoverState> = {}): HoverState {
  return {
    listingId: null,
    sectionId: null,
    rowId: null,
    ...overrides,
  };
}

describe('pin visibility rules', () => {
  it('hides section mode regular pins when a selected listing exists in section', () => {
    const pin = createPin();
    const visible = isPinVisible(pin, {
      displayMode: 'sections',
      pins: [pin],
      sectionId: 'A',
      selectedListing: createListing({ sectionId: 'A' }),
      hoverTarget: null,
    });

    expect(visible).toBe(false);
  });

  it('shows only lowest-price section mode pin', () => {
    const expensive = createPin({ listing: createListing({ listingId: 'listing-A-1', price: 12000 }) });
    const cheap = createPin({ listing: createListing({ listingId: 'listing-A-2', price: 9000 }) });

    const context = {
      displayMode: 'sections' as DisplayMode,
      pins: [expensive, cheap],
      sectionId: 'A',
      selectedListing: null,
      hoverTarget: null,
    };

    expect(isPinVisible(expensive, context)).toBe(false);
    expect(isPinVisible(cheap, context)).toBe(true);
  });

  it('hides row and seat pins that overlap hover/selected overlays', () => {
    const rowPin = createPin({ listing: createListing({ listingId: 'row-pin', rowNumber: 2 }), rowIndex: 1 });
    const seatPin = createPin({ listing: createListing({ listingId: 'seat-pin' }), rowIndex: 0, seatIndex: 3 });

    expect(
      isPinVisible(rowPin, {
        displayMode: 'rows',
        pins: [rowPin],
        sectionId: 'A',
        selectedListing: createListing({ sectionId: 'A', rowNumber: 2 }),
        hoverTarget: { kind: 'row', listing: createListing({ listingId: 'hover-row', rowNumber: 3 }), rowIndex: 2 },
      }),
    ).toBe(false);

    expect(
      isPinVisible(seatPin, {
        displayMode: 'seats',
        pins: [seatPin],
        sectionId: 'A',
        selectedListing: createListing({ sectionId: 'A', listingId: 'seat-pin' }),
        hoverTarget: { kind: 'seat', listing: createListing({ listingId: 'hover-seat' }), rowIndex: 0, seatIndex: 2 },
      }),
    ).toBe(false);
  });
});

describe('pin hover/selected precedence', () => {
  it('prefers selected over hover visual state', () => {
    expect(getOverlayPinVisualState({ isSelected: true, isHovered: true })).toBe('selected');
    expect(getOverlayPinVisualState({ isSelected: false, isHovered: true })).toBe('hover');
  });

  it('suppresses hover pin target when hovered listing is already selected', () => {
    const selected = createListing({ listingId: 'listing-A-1' });
    const hoverState = createHover({ sectionId: 'A', listingId: 'listing-A-1' });
    const target = getHoverPinTarget({
      displayMode: 'seats',
      hoverState,
      sectionId: 'A',
      sectionListings: [selected],
      selectedListing: selected,
    });

    expect(target).toBeNull();
  });
});
