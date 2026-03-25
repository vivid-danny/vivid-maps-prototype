/**
 * Layer stack aligned with production styleJSONv2.ts.
 * See Confluence: "Style JSON Breakdown" (MOB space).
 *
 * Production layer stack (bottom → top):
 * background → venue → venue-stroke → section-base → section →
 * section-selected-overlay → row → row-selected-overlay → row-outline →
 * section-outline → section-selected-outline → section-label → row-label → seat
 *
 * Divergences from production:
 * - GeoJSON sources (not vector tiles) — different filter patterns
 * - Seat-level circle layer (production stops at rows)
 * - Synthetic coords: prototype zoom ≈ production zoom + 8
 * - Hard visibility toggling (not opacity crossfade)
 * - Three color themes (branded/zone/deal) for design exploration
 */
import type { StyleSpecification } from 'maplibre-gl';
import {
  BACKGROUND_COORDINATES,
  GLYPHS_URL,
  LAYER_ROW,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SECTION,
  LAYER_SECTION_BASE,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_OUTLINE,
  LAYER_SECTION_SELECTED_OUTLINE,
  LAYER_SECTION_SELECTED_OVERLAY,
  SOURCE_ROWS,
  SOURCE_SEATS,
  SOURCE_SECTION_LABELS,
  SOURCE_SECTIONS,
  STYLE_COLORS,
  THEME_TOKENS,
} from './constants';
import type { SeatColors } from '../../model/types';
import type { VenueAssets } from './types';

interface StyleOptions {
  seatColors: SeatColors;
  assets: VenueAssets;
  rowStrokeColor: string;
}

export function createVenueStyle(options: StyleOptions): StyleSpecification {
  const { seatColors, assets, rowStrokeColor } = options;

  // Base fill expression: hovered > unavailable > base color.
  // Selection is handled by dedicated overlay layers (section-selected-overlay,
  // row-selected-overlay) matching the production pattern.
  const sectionFillColor = [
    'case',
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
      [SOURCE_SECTION_LABELS]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      },
    },
    layers: [
      // 1. Map background — production: theme.colors.rawPalette.neutral[50]
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': seatColors.mapBackground },
      },

      // 2. Venue chrome — raster image from pipeline (always visible)
      // Production uses fill + stroke layers for the stadium shape; we use a raster image.
      {
        id: 'venue-background',
        type: 'raster',
        source: 'venue-background',
        paint: { 'raster-opacity': 1 },
      },

      // 3. Section base — neutral fill under all sections (always visible).
      // Shows through when a section has no inventory color.
      // Production: theme.colors.rawPalette.neutral[100]
      {
        id: LAYER_SECTION_BASE,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': THEME_TOKENS.sectionBase,
          'fill-opacity': 1,
        },
      },

      // 4. Section fill — colored by theme (branded/zone/deal).
      // Visibility toggled by displayMode; filter applied imperatively from manifest.
      {
        id: LAYER_SECTION,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': sectionFillColor,
          'fill-opacity': 1,
        },
      },

      // 5. Section selected overlay — dark tint on selected, white mute on others.
      // Hidden until a section is selected; managed via setLayoutProperty + setPaintProperty.
      // Production: fill-color uses match expression on feature id.
      {
        id: LAYER_SECTION_SELECTED_OVERLAY,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': STYLE_COLORS.muted,
        },
      },

      // 6. Row fill — colored same as parent section.
      // Visibility toggled by displayMode; filter applied imperatively from manifest.
      {
        id: LAYER_ROW,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': sectionFillColor,
          'fill-opacity': 1,
        },
      },

      // 7. Row selected overlay — selected row gets dark tint, siblings get muted.
      // Production: match expression on id; prototype uses feature-state.
      {
        id: LAYER_ROW_SELECTED_OVERLAY,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], STYLE_COLORS.selected,
            STYLE_COLORS.muted,
          ],
        },
      },

      // 8. Row outline — borders between rows.
      // Production: line-color is sectionNoInventoryFill (#E3E3E8)
      {
        id: LAYER_ROW_OUTLINE,
        type: 'line',
        source: SOURCE_ROWS,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': rowStrokeColor,
          'line-width': 0.5,
        },
      },

      // 9. Section outline — always visible, opacity varies by displayMode.
      // Production: opacity 0.3 at section zoom → 1.0 at row zoom. Fixed 0.5px width.
      // Provides spatial anchoring at row/seat zoom levels.
      {
        id: LAYER_SECTION_OUTLINE,
        type: 'line',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'line-color': seatColors.sectionStroke,
          'line-width': 0.5,
          'line-opacity': 0.3,
        },
      },

      // 10. Section selected outline — 2px border around selected section.
      // Visible only in rows/seats modes. Production uses line-width transition (0→2px).
      {
        id: LAYER_SECTION_SELECTED_OUTLINE,
        type: 'line',
        source: SOURCE_SECTIONS,
        filter: ['==', 'id', ''],
        layout: { visibility: 'none' },
        paint: {
          'line-color': seatColors.sectionStroke,
          'line-width': 2,
        },
      },

      // 11. Row labels — visible in rows/seats modes.
      // Production: text-field {l}, font roboto-bold, fades in at zoom 8.5→9.
      {
        id: LAYER_ROW_LABEL,
        type: 'symbol',
        source: SOURCE_ROWS,
        layout: {
          visibility: 'none',
          'text-field': ['get', 'rowId'],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 4, 18, 16],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': seatColors.labelDefault,
        },
      },

      // 12. Seats — prototype-only circle layer (production stops at row level).
      {
        id: LAYER_SEAT,
        type: 'circle',
        source: SOURCE_SEATS,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': sectionFillColor,
          'circle-radius': [
            'interpolate', ['exponential', 2], ['zoom'],
            14, 2,
            20, 128,
          ],
          'circle-stroke-width': 0,
        },
      },

      // 13. Section labels — rendered above seats so they're always readable.
      // One point per section from SOURCE_SECTION_LABELS (populated from manifest centers).
      // Dimmed (0.3 opacity) at row/seat zoom levels.
      {
        id: LAYER_SECTION_LABEL,
        type: 'symbol',
        source: SOURCE_SECTION_LABELS,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'sectionId'],
          'text-font': ['Open Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 18, 28],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': seatColors.labelDefault,
          'text-halo-color': STYLE_COLORS.textHaloColor,
          'text-halo-width': STYLE_COLORS.textHaloWidth,
        },
      },
    ],
  };
}
