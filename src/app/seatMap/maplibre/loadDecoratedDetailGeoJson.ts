import { buildRowFeatureId } from '../model/ids';
import type { SeatMapModel } from '../model/types';

function isFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection {
  return !!value
    && typeof value === 'object'
    && 'type' in value
    && (value as { type?: string }).type === 'FeatureCollection'
    && 'features' in value
    && Array.isArray((value as { features?: unknown }).features);
}

async function fetchFeatureCollection(url: string): Promise<GeoJSON.FeatureCollection> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GeoJSON from ${url}: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isFeatureCollection(data)) {
    throw new Error(`Invalid GeoJSON FeatureCollection at ${url}`);
  }

  return data;
}

function decorateFeatures(
  source: GeoJSON.FeatureCollection,
  isUnavailable: (feature: GeoJSON.Feature) => boolean,
): GeoJSON.FeatureCollection {
  return {
    ...source,
    features: source.features.map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        unavailable: isUnavailable(feature),
      },
    })),
  };
}

export async function loadDecoratedRowsGeoJson(
  rowsUrl: string,
  model: SeatMapModel,
): Promise<GeoJSON.FeatureCollection> {
  const rowsWithListings = new Set<string>();
  for (const listing of model.listings) {
    if (!listing.rowId) continue;
    rowsWithListings.add(buildRowFeatureId(listing.sectionId, listing.rowId));
  }

  const source = await fetchFeatureCollection(rowsUrl);
  return decorateFeatures(source, (feature) => {
    const rowId = typeof feature.properties?.id === 'string'
      ? feature.properties.id
      : null;
    return rowId ? !rowsWithListings.has(rowId) : true;
  });
}

export async function loadDecoratedSeatsGeoJson(
  seatsUrl: string,
  model: SeatMapModel,
): Promise<GeoJSON.FeatureCollection> {
  const seatsWithListings = new Set<string>();
  for (const listing of model.listings) {
    for (const seatId of listing.seatIds) {
      seatsWithListings.add(seatId);
    }
  }

  const source = await fetchFeatureCollection(seatsUrl);
  return decorateFeatures(source, (feature) => {
    const seatId = typeof feature.properties?.id === 'string'
      ? feature.properties.id
      : null;
    return seatId ? !seatsWithListings.has(seatId) : true;
  });
}
