import { createManifestSeatMapModel } from './createManifestSeatMapModel';
import type { SeatMapModel } from '../model/types';
import type { VenueAssets } from '../maplibre/types';

export interface MapDefinition {
  id: string;
  label: string;
  createModel: () => SeatMapModel;
  assets: VenueAssets;
}

export const MAP_REGISTRY: MapDefinition[] = [
  {
    id: 'stadium',
    label: 'Stadium',
    createModel: createManifestSeatMapModel,
    assets: {
      manifestUrl: '/manifest.json',
      venueChromeUrl: '/venue-chrome.geojson',
      backgroundImageUrl: '/background.png',
      sectionsUrl: '/sections.geojson',
      rowsUrl: '/rows.geojson',
      seatsUrl: '/seats.geojson',
    },
  },
];

