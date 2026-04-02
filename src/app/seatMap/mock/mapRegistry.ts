import { createManifestSeatMapModel } from './createManifestSeatMapModel';
import type { SeatMapModel } from '../model/types';
import type { VenueAssets } from '../maplibre/types';

export interface MapScaleDefaults {
  desktopInitialScale: number;
  desktopZoomThreshold: number;
  mobileInitialScale: number;
  mobileZoomThreshold: number;
}

export interface MapDefinition {
  id: string;
  label: string;
  createModel: () => SeatMapModel;
  scaleDefaults: MapScaleDefaults;
  assets: VenueAssets;
}

export const MAP_REGISTRY: MapDefinition[] = [
  {
    id: 'stadium',
    label: 'Stadium',
    createModel: createManifestSeatMapModel,
    assets: {
      manifestUrl: '/manifest.json',
      backgroundImageUrl: '/background.png',
      sectionsUrl: '/sections.geojson',
      rowsUrl: '/rows.geojson',
      seatsUrl: '/seats.geojson',
    },
    scaleDefaults: {
      desktopInitialScale: 0.12,
      desktopZoomThreshold: 0.3,
      mobileInitialScale: 0.03,
      mobileZoomThreshold: 0.15,
    },
  },
];

