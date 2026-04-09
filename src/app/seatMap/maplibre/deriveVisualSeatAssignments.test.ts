import { describe, expect, it } from 'vitest';
import { createManifestSeatMapModel } from '../mock/createManifestSeatMapModel';
import { deriveVisualSeatAssignments } from './deriveVisualSeatAssignments';
import type { DeliveryInfo, EventInfo, Listing, PinData, SeatMapModel, SectionConfig, SectionData } from '../model/types';
import { buildSeatFeatureId } from '../model/ids';

const DELIVERY: DeliveryInfo = {
  method: 'mobile_transfer',
  label: 'Mobile Transfer',
  description: 'Transfer',
};

const EVENT_INFO: EventInfo = {
  eventName: 'Event',
  eventDate: 'Date',
  venueName: 'Venue',
  venueAddress: 'Address',
};

function createListing(overrides: Partial<Listing> & Pick<Listing, 'listingId' | 'sectionId' | 'sectionLabel'>): Listing {
  return {
    listingId: overrides.listingId,
    sectionId: overrides.sectionId,
    sectionLabel: overrides.sectionLabel,
    rowId: overrides.rowId ?? null,
    rowNumber: overrides.rowNumber ?? null,
    seatIds: overrides.seatIds ?? [],
    price: overrides.price ?? 10000,
    seatViewUrl: overrides.seatViewUrl ?? 'seat-view.png',
    perks: overrides.perks ?? [],
    dealScore: overrides.dealScore ?? 5,
    quantityAvailable: overrides.quantityAvailable ?? 2,
    feePerTicket: overrides.feePerTicket ?? 1000,
    delivery: overrides.delivery ?? DELIVERY,
    isUnmapped: overrides.isUnmapped,
  };
}

function createModel(sectionId: string, rowIds: string[], listings: Listing[]): SeatMapModel {
  const rows = rowIds.map((rowId) => ({
    rowId,
    seats: [1, 2, 3].map((seatNumber) => ({
      seatId: buildSeatFeatureId(sectionId, rowId, seatNumber),
      status: 'unavailable' as const,
    })),
  }));
  const sectionData: SectionData = { sectionId, rows };
  const sections: SectionConfig[] = [{
    sectionId,
    label: sectionId,
    numRows: rowIds.length,
    seatsPerRow: 3,
    x: 0,
    y: 0,
  }];
  const listingsBySection = new Map<string, Listing[]>([[sectionId, listings]]);
  const sectionDataById = new Map<string, SectionData>([[sectionId, sectionData]]);

  return {
    id: 'test-map',
    name: 'Test Map',
    sections,
    seed: 1,
    listings,
    listingsBySection,
    sectionDataById,
    pinsBySection: new Map<string, PinData[]>(),
    eventInfo: EVENT_INFO,
  };
}

describe('deriveVisualSeatAssignments', () => {
  it('assigns full-row visual seats to the winning row-scoped unmapped listing in reserved sections', () => {
    const model = createManifestSeatMapModel();
    const assignments = deriveVisualSeatAssignments(model);
    const sectionData = model.sectionDataById.get('214')!;
    const row = sectionData.rows.find((entry) => entry.rowId === '5')!;
    const rowListings = model.listings
      .filter((listing) => listing.sectionId === '214' && listing.rowId === '5' && listing.seatIds.length === 0)
      .sort((a, b) => a.price - b.price || b.dealScore - a.dealScore || a.listingId.localeCompare(b.listingId));
    const winner = rowListings[0]!;
    const loser = rowListings[1]!;
    const fullRowSeatIds = row.seats.map((seat) => seat.seatId);

    expect(assignments.visualSeatIdsByListingId.get(winner.listingId)).toEqual(fullRowSeatIds);
    expect(assignments.visualCoverageKindByListingId.get(winner.listingId)).toBe('row_unmapped');
    expect(assignments.visualSeatIdsByListingId.get(loser.listingId)).toEqual([]);
    expect(assignments.visualSeatListingBySeatId.get(fullRowSeatIds[0])?.listingId).toBe(winner.listingId);
  });

  it('keeps back-row section-only listings panel-only when a row-scoped back-row listing exists', () => {
    const model = createManifestSeatMapModel();
    const assignments = deriveVisualSeatAssignments(model);

    expect(assignments.visualCoverageKindByListingId.get('listing-214-9-unmapped-full-row')).toBe('row_unmapped');
    expect(assignments.visualSeatIdsByListingId.get('listing-214-section-unmapped-1')).toEqual([]);
    expect(assignments.visualSeatIdsByListingId.get('listing-214-section-unmapped-2')).toEqual([]);
  });

  it('keeps same-row unmapped overflow panel-only when a mapped listing exists in that row', () => {
    const model = createManifestSeatMapModel();
    const assignments = deriveVisualSeatAssignments(model);
    const sectionData = model.sectionDataById.get('214')!;
    const rowIds = sectionData.rows.map((row) => row.rowId);
    const mixedMappedRowId = rowIds.find((rowId) => rowId !== '5' && rowId !== '1' && rowId !== '9')!;
    const mappedListing = model.listings.find((listing) => listing.listingId === `listing-214-${mixedMappedRowId}-mapped-priority-demo`);
    const unmappedOverflow = model.listings.find((listing) => listing.listingId === `listing-214-${mixedMappedRowId}-mapped-row-unmapped-1`);

    expect(mappedListing?.seatIds).toEqual([`214:${mixedMappedRowId}:s1`, `214:${mixedMappedRowId}:s2`]);
    expect(assignments.visualSeatIdsByListingId.get(mappedListing!.listingId)).toEqual([
      `214:${mixedMappedRowId}:s1`,
      `214:${mixedMappedRowId}:s2`,
    ]);
    expect(assignments.visualCoverageKindByListingId.get(mappedListing!.listingId)).toBe('mapped');
    expect(assignments.visualSeatIdsByListingId.get(unmappedOverflow!.listingId)).toEqual([]);
    expect(assignments.visualCoverageKindByListingId.has(unmappedOverflow!.listingId)).toBe(false);
  });

  it('falls back to section-scoped back-row coverage when no row-scoped back-row listing exists', () => {
    const sectionOnly = createListing({
      listingId: 'listing-214-section-only',
      sectionId: '214',
      sectionLabel: '214',
      price: 9000,
      isUnmapped: true,
    });
    const model = createModel('214', ['1', '2'], [sectionOnly]);
    const assignments = deriveVisualSeatAssignments(model);
    const fullBackRowSeatIds = model.sectionDataById.get('214')!.rows[1]!.seats.map((seat) => seat.seatId);

    expect(assignments.visualSeatIdsByListingId.get(sectionOnly.listingId)).toEqual(fullBackRowSeatIds);
    expect(assignments.visualCoverageKindByListingId.get(sectionOnly.listingId)).toBe('section_unmapped');
    expect(assignments.visualRowIdByListingId.get(sectionOnly.listingId)).toBe('2');
  });

  it('does not synthesize seat coverage for non-reserved sections', () => {
    const rowScoped = createListing({
      listingId: 'listing-500-1-row-unmapped',
      sectionId: '500',
      sectionLabel: '500',
      rowId: '1',
      rowNumber: 1,
      price: 9000,
      isUnmapped: true,
    });
    const model = createModel('500', ['1', '2'], [rowScoped]);
    const assignments = deriveVisualSeatAssignments(model);

    expect(assignments.visualSeatIdsByListingId.get(rowScoped.listingId)).toEqual([]);
    expect(assignments.visualCoverageKindByListingId.has(rowScoped.listingId)).toBe(false);
  });
});
