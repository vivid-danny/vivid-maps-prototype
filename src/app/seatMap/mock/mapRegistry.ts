import { createVenueSeatMapModel } from './createVenueSeatMapModel';
import { createTheaterSeatMapModel } from './createTheaterSeatMapModel';
import type { VenueSeatMapModel } from './createVenueSeatMapModel';
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
  createModel: () => VenueSeatMapModel;
  scaleDefaults: MapScaleDefaults;
  assets: VenueAssets;
}

export const MAP_REGISTRY: MapDefinition[] = [
  {
    id: 'stadium',
    label: 'Stadium',
    createModel: createVenueSeatMapModel,
    assets: {
      manifestUrl: '/manifest.json',
      backgroundUrl: '/background.png',
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
  {
    id: 'theater',
    label: 'Theater',
    createModel: createTheaterSeatMapModel,
    assets: {
      manifestUrl: '',
      backgroundUrl: '',
      sectionsUrl: '',
      rowsUrl: '',
      seatsUrl: '',
    },
    scaleDefaults: {
      desktopInitialScale: 0.15,
      desktopZoomThreshold: 0.35,
      mobileInitialScale: 0.05,
      mobileZoomThreshold: 0.2,
    },
  },
];

export const DEFAULT_MAP_ID = 'stadium';
export const MAP_IDS = MAP_REGISTRY.map((m) => m.id);
