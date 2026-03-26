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
  RINK_COORDINATES,
  GLYPHS_URL,
  LAYER_ROW,
  LAYER_ROW_HOVER_OVERLAY,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SEAT_HOVER_OVERLAY,
  LAYER_SEAT_SELECTED_OVERLAY,
  LAYER_SECTION,
  LAYER_SECTION_BASE,
  LAYER_SECTION_HOVER_OVERLAY,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_OUTLINE,
  LAYER_SECTION_SELECTED_OUTLINE,
  LAYER_SECTION_SELECTED_OVERLAY,
  SOURCE_ROWS,
  SOURCE_SEATS,
  SOURCE_SECTION_LABELS,
  SOURCE_SECTIONS,
  STYLE_COLORS,
} from './constants';
import type { SeatColors } from '../../model/types';
import type { VenueAssets } from './types';

interface StyleOptions {
  seatColors: SeatColors;
  assets: VenueAssets;
  venueFill: string;
  venueStroke: string;
  sectionStroke: string;
  mapBackground: string;
  sectionBase: string;
  rowStrokeColor: string;
  rowFillColor: string;
  mutedOverlay: string;
  selectedOverlay: string;
  hoverOverlay: string;
  selectedOutlineColor: string;
}

export function createVenueStyle(options: StyleOptions): StyleSpecification {
  const {
    seatColors, assets, venueFill, venueStroke, sectionStroke,
    mapBackground, sectionBase, rowStrokeColor, rowFillColor, mutedOverlay, selectedOverlay, hoverOverlay, selectedOutlineColor,
  } = options;

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
      'venue-chrome': {
        type: 'geojson',
        data: assets.venueChromeUrl,
      },
      ...(assets.rinkUrl ? {
        'venue-rink': {
          type: 'image',
          url: assets.rinkUrl,
          coordinates: RINK_COORDINATES,
        },
      } : {}),
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
        paint: { 'background-color': mapBackground },
      },

      // 2. Venue fill — stadium shape polygon (always visible).
      // Production: theme.colors.onPrimary (white)
      {
        id: 'venue',
        type: 'fill',
        source: 'venue-chrome',
        paint: { 'fill-color': venueFill },
      },

      // 3. Venue stroke — stadium boundary line (always visible).
      // Production: theme.colors.onSurfaceDisabled
      {
        id: 'venue-stroke',
        type: 'line',
        source: 'venue-chrome',
        paint: {
          'line-color': venueStroke,
          'line-width': 1,
        },
      },

      // 4. Rink image — playing surface PNG (optional, shown when rinkUrl provided).
      ...(assets.rinkUrl ? [{
        id: 'venue-rink',
        type: 'raster' as const,
        source: 'venue-rink',
        paint: { 'raster-opacity': 1 },
      }] : []),

      // 5. Section base — neutral fill under all sections (always visible).
      // Shows through when a section has no inventory color.
      // Production: theme.colors.rawPalette.neutral[100]
      {
        id: LAYER_SECTION_BASE,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': sectionBase,
          'fill-opacity': 1,
        },
      },

      // 6. Section fill — colored by theme (branded/zone/deal).
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

      // 5a. Section hover overlay — composited on top of section base color.
      // Feature-state driven: only shows overlay color on hovered section, transparent elsewhere.
      // Always visible; displayMode effect hides it in rows/seats modes.
      {
        id: LAYER_SECTION_HOVER_OVERLAY,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'visible' },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false], hoverOverlay,
            'rgba(0,0,0,0)',
          ],
        },
      },

      // 5b. Section selected overlay — dark tint on selected, white mute on others.
      // Hidden until a section is selected; managed via setLayoutProperty + setPaintProperty.
      // Production: fill-color uses match expression on feature id.
      {
        id: LAYER_SECTION_SELECTED_OVERLAY,
        type: 'fill',
        source: SOURCE_SECTIONS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': mutedOverlay,
        },
      },

      // 6. Row fill — neutral background color so seat circles stand out.
      // Visibility toggled by displayMode; filter applied imperatively from manifest.
      {
        id: LAYER_ROW,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': rowFillColor,
          'fill-opacity': 1,
        },
      },

      // 7a. Row hover overlay — composited on top of row fill color.
      // Feature-state driven; hidden by default, shown in rows + seats modes.
      {
        id: LAYER_ROW_HOVER_OVERLAY,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false], hoverOverlay,
            'rgba(0,0,0,0)',
          ],
        },
      },

      // 7b. Row selected overlay — selected row gets dark tint, siblings get muted.
      // Production: match expression on id; prototype uses feature-state.
      {
        id: LAYER_ROW_SELECTED_OVERLAY,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], selectedOverlay,
            mutedOverlay,
          ],
        },
      },

      // 8. Row selected outline — outline around selected row (feature-state driven).
      {
        id: LAYER_ROW_SELECTED_OUTLINE,
        type: 'line',
        source: SOURCE_ROWS,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], selectedOutlineColor,
            'rgba(0,0,0,0)',
          ],
          'line-width': 1.5,
        },
      },

      // 9. Row outline — borders between rows.
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
          'line-color': sectionStroke,
          'line-width': 0.5,
          'line-opacity': 0.3,
        },
      },

      // 10. Section selected outline — 2px border around selected section (all zoom levels).
      // Production uses line-width transition (0→2px).
      {
        id: LAYER_SECTION_SELECTED_OUTLINE,
        type: 'line',
        source: SOURCE_SECTIONS,
        filter: ['==', 'id', ''],
        layout: { visibility: 'none' },
        paint: {
          'line-color': selectedOutlineColor,
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
          'text-font': ['GTWalsh Bold'],
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

      // 13a. Seat hover overlay — composited on top of seat circles.
      // Feature-state driven; hidden by default, shown in seats mode only.
      {
        id: LAYER_SEAT_HOVER_OVERLAY,
        type: 'circle',
        source: SOURCE_SEATS,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false], hoverOverlay,
            'rgba(0,0,0,0)',
          ],
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 14, 2, 20, 128],
        },
      },

      // 13b. Seat selected overlay — dark tint + outline ring on selected row's seats (filter-driven).
      // Uses a sectionId+rowId filter (like section-selected-outline) so it works whether a row
      // listing or an individual seat is selected — no per-seat feature-state required.
      {
        id: LAYER_SEAT_SELECTED_OVERLAY,
        type: 'circle',
        source: SOURCE_SEATS,
        filter: ['all', ['==', ['get', 'sectionId'], ''], ['==', ['get', 'rowId'], '']],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': selectedOverlay,
          'circle-radius': [
            'interpolate', ['exponential', 2], ['zoom'],
            14, 2,
            20, 128,
          ],
          'circle-stroke-color': selectedOutlineColor,
          'circle-stroke-width': [
            'interpolate', ['exponential', 2], ['zoom'],
            14, 0.3,
            20, 16,
          ],
        },
      },

      // 14. Section labels — rendered above seats so they're always readable.
      // One point per section from SOURCE_SECTION_LABELS (populated from manifest centers).
      // Dimmed (0.3 opacity) at row/seat zoom levels.
      {
        id: LAYER_SECTION_LABEL,
        type: 'symbol',
        source: SOURCE_SECTION_LABELS,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'sectionId'],
          'text-font': ['GTWalsh Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 18, 28],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': seatColors.labelDefault,
        },
      },
    ],
  };
}
