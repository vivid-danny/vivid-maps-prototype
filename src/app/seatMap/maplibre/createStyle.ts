import type { StyleSpecification } from 'maplibre-gl';
import {
  BACKGROUND_COORDINATES,
  GLYPHS_URL,
  LAYER_ROW_FILL,
  LAYER_SEAT,
  LAYER_SECTION_FILL,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_STROKE,
  SOURCE_ROWS,
  SOURCE_SEATS,
  SOURCE_SECTIONS,
} from './constants';
import type { SeatColors } from '../../model/types';
import type { VenueAssets } from './types';

interface StyleOptions {
  seatColors: SeatColors;
  assets: VenueAssets;
}

export function createVenueStyle(options: StyleOptions): StyleSpecification {
  const { seatColors, assets } = options;

  const sectionFillColor = [
    'case',
    ['boolean', ['feature-state', 'selected'], false], seatColors.selected,
    ['boolean', ['feature-state', 'hovered'], false], seatColors.hover,
    ['boolean', ['feature-state', 'unavailable'], false], seatColors.unavailable,
    seatColors.available,
  ] as const;

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      'venue-background': {
        type: 'image',
        url: assets.backgroundUrl,
        coordinates: BACKGROUND_COORDINATES,
      },
      [SOURCE_SECTIONS]: {
        type: 'geojson',
        data: assets.sectionsUrl,
        promoteId: 'id',
      },
      [SOURCE_ROWS]: {
        type: 'geojson',
        data: assets.rowsUrl,
        promoteId: 'id',
      },
      [SOURCE_SEATS]: {
        type: 'geojson',
        data: assets.seatsUrl,
        promoteId: 'id',
      },
    },
    layers: [
      // Map background color
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': seatColors.mapBackground },
      },

      // Venue chrome — raster image from pipeline (always visible)
      {
        id: 'venue-background',
        type: 'raster',
        source: 'venue-background',
        paint: { 'raster-opacity': 1 },
      },

      // --- Sections — filter applied imperatively from manifest, visibility toggled by displayMode ---
      {
        id: LAYER_SECTION_FILL,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': sectionFillColor,
          'fill-opacity': 1,
        },
      },
      {
        id: LAYER_SECTION_STROKE,
        type: 'line',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'line-color': seatColors.mapBackground,
          'line-width': 0,
        },
      },
      {
        id: LAYER_SECTION_LABEL,
        type: 'symbol',
        source: SOURCE_SECTIONS,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'sectionId'],
          'text-font': ['Open Sans Bold'],
          'text-size': 9,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.4)',
          'text-halo-width': 1,
        },
      },

      // --- Rows — hidden by default, toggled by displayMode ---
      {
        id: LAYER_ROW_FILL,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': sectionFillColor,
          'fill-opacity': 1,
        },
      },

      // --- Seats — hidden by default, toggled by displayMode ---
      {
        id: LAYER_SEAT,
        type: 'circle',
        source: SOURCE_SEATS,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': sectionFillColor,
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            14, 1.5,
            16, 2.5,
            18, 4,
          ],
          'circle-stroke-color': seatColors.mapBackground,
          'circle-stroke-width': 0.5,
        },
      },
    ],
  };
}
