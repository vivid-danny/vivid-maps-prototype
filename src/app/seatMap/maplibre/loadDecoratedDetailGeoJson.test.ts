import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecoratedRowsGeoJson, loadDecoratedSeatsGeoJson } from './loadDecoratedDetailGeoJson';
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

  return {
    id: 'test-map',
    name: 'Test Map',
    sections,
    seed: 1,
    listings,
    listingsBySection: new Map<string, Listing[]>([[sectionId, listings]]),
    sectionDataById: new Map<string, SectionData>([[sectionId, sectionData]]),
    pinsBySection: new Map<string, PinData[]>(),
    eventInfo: EVENT_INFO,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDecoratedDetailGeoJson', () => {
  it('marks synthetic row-unmapped seat coverage as available', async () => {
    const model = createModel('214', ['1'], [
      createListing({
        listingId: 'listing-214-1-row-unmapped',
        sectionId: '214',
        sectionLabel: '214',
        rowId: '1',
        rowNumber: 1,
        isUnmapped: true,
      }),
    ]);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
            properties: { id: '214:1', sectionId: '214', rowId: '1' },
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [1, 2, 3].map((seatNumber) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: { id: buildSeatFeatureId('214', '1', seatNumber) },
          })),
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await loadDecoratedRowsGeoJson('/rows', model);
    const seats = await loadDecoratedSeatsGeoJson('/seats', model);

    expect(rows.features[0]?.properties?.unavailable).toBe(false);
    expect(seats.features.every((feature) => feature.properties?.unavailable === false)).toBe(true);
  });

  it('marks synthetic section-only back-row seat coverage as available', async () => {
    const model = createModel('214', ['1', '2'], [
      createListing({
        listingId: 'listing-214-section-only',
        sectionId: '214',
        sectionLabel: '214',
        isUnmapped: true,
      }),
    ]);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: rowFeatures(['214:1', '214:2']),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            1, 2, 3,
          ].flatMap((seatNumber) => ([
            seatFeature(buildSeatFeatureId('214', '1', seatNumber)),
            seatFeature(buildSeatFeatureId('214', '2', seatNumber)),
          ])),
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const rows = await loadDecoratedRowsGeoJson('/rows', model);
    const seats = await loadDecoratedSeatsGeoJson('/seats', model);

    expect(rows.features.find((feature) => feature.properties?.id === '214:1')?.properties?.unavailable).toBe(true);
    expect(rows.features.find((feature) => feature.properties?.id === '214:2')?.properties?.unavailable).toBe(false);
    expect(seats.features.find((feature) => feature.properties?.id === '214:1:s1')?.properties?.unavailable).toBe(true);
    expect(seats.features.find((feature) => feature.properties?.id === '214:2:s1')?.properties?.unavailable).toBe(false);
  });
});

function rowFeatures(ids: string[]): GeoJSON.Feature[] {
  return ids.map((id) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [] },
    properties: { id },
  }));
}

function seatFeature(id: string): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { id },
  };
}
