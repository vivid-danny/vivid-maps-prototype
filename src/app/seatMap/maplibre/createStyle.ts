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
import type { StyleSpecification, ExpressionSpecification } from 'maplibre-gl';
import {
  BACKGROUND_IMAGE_COORDINATES,
  GLYPHS_URL,
  LAYER_ROW,
  LAYER_ROW_HOVER_OVERLAY,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SEAT_INTERACTION,
  LAYER_SEAT_CONNECTOR,
  LAYER_SEAT_CONNECTOR_MUTED_OVERLAY,
  LAYER_SEAT_HOVER_OVERLAY,
  LAYER_SEAT_MUTED_OVERLAY,
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
  SOURCE_SEAT_CONNECTORS,
  SOURCE_SECTION_LABELS,
  SOURCE_SECTIONS,
  STYLE_COLORS,
} from './constants';
import type { SeatColors } from '../model/types';
import type { VenueAssets } from './types';
import type { LevelOverlays } from '../config/types';

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
  overlays: { section: LevelOverlays; row: LevelOverlays; seat: LevelOverlays };
}

export function createVenueStyle(options: StyleOptions): StyleSpecification {
  const {
    seatColors, assets, venueFill, venueStroke, sectionStroke,
    mapBackground, sectionBase, rowStrokeColor, rowFillColor, overlays,
  } = options;

  // Shared zoom-interpolated size expressions — seat radius and connector width scale at the
  // same exponential rate so they stay proportional across zoom levels.
  const SEAT_RADIUS_EXPR: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 14, 1.5, 20, 80];
  const SEAT_INTERACTION_RADIUS_EXPR: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 14, 8, 20, 144];
  const CONNECTOR_WIDTH_EXPR: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 14, 0.75, 20, 48];

  // Base fill expression: hovered > unavailable > base color.
  // Selection is handled by dedicated overlay layers (section-selected-overlay,
  // row-selected-overlay) matching the production pattern.
  const sectionFillColor: ExpressionSpecification = [
    'case',
    ['boolean', ['feature-state', 'hovered'], false], seatColors.hover,
    ['boolean', ['feature-state', 'unavailable'], false], seatColors.unavailable,
    seatColors.available,
  ];

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      ...(assets.venueChromeUrl ? {
        'venue-chrome': {
          type: 'geojson',
          data: assets.venueChromeUrl,
        },
      } : {}),
      ...(assets.backgroundImageUrl ? {
        'venue-background': {
          type: 'image',
          url: assets.backgroundImageUrl,
          coordinates: BACKGROUND_IMAGE_COORDINATES,
        },
      } : {}),
      [SOURCE_SECTIONS]: {
        type: 'geojson',
        data: assets.sectionsUrl,
        promoteId: 'id',
      },
      // Rows and seats start empty — loaded on demand when displayMode leaves 'sections'.
      // This avoids parsing 8.5MB of GeoJSON at init while the user is still at section zoom.
      [SOURCE_ROWS]: {
        type: 'geojson',
        data: { type: 'FeatureCollection' as const, features: [] },
        promoteId: 'id',
        buffer: 48,      // reduced from default 128; moderate overlap for polygon edges
        tolerance: 0.5,  // slight simplification for row polygons
      },
      [SOURCE_SEATS]: {
        type: 'geojson',
        data: { type: 'FeatureCollection' as const, features: [] },
        promoteId: 'id',
        buffer: 32,      // points need minimal boundary overlap
        tolerance: 0,    // no simplification for Point geometry
        maxzoom: 20,     // generate proper tiles at deep zooms instead of overscaling from z14
      },
      [SOURCE_SEAT_CONNECTORS]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        promoteId: 'listingId',
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

      // 2. Venue fill — stadium shape polygon (optional, needs venue-chrome source).
      // Production: theme.colors.onPrimary (white)
      ...(assets.venueChromeUrl ? [{
        id: 'venue',
        type: 'fill' as const,
        source: 'venue-chrome',
        paint: { 'fill-color': venueFill },
      }] : []),

      // 3. Background image — venue/playing surface PNG (optional, fallback for venues without vector field).
      ...(assets.backgroundImageUrl ? [{
        id: 'venue-background',
        type: 'raster' as const,
        source: 'venue-background',
        paint: { 'raster-opacity': 1 },
      }] : []),

      // 4. Venue stroke — stadium boundary line (above background/field).
      // Production: theme.colors.onSurfaceDisabled
      ...(assets.venueChromeUrl ? [{
        id: 'venue-stroke',
        type: 'line' as const,
        source: 'venue-chrome',
        paint: {
          'line-color': venueStroke,
          'line-width': 1,
        },
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
            ['boolean', ['feature-state', 'hovered'], false], overlays.section.hover,
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
          'fill-color': overlays.section.muted,
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
            ['boolean', ['feature-state', 'hovered'], false], overlays.row.hover,
            'rgba(0,0,0,0)',
          ],
        },
      },

      // 7b. Row selected overlay — selected, hovered, and cross-level muting.
      // Paint expression is managed at runtime by useMapSelectionSync via setPaintProperty.
      {
        id: LAYER_ROW_SELECTED_OVERLAY,
        type: 'fill',
        source: SOURCE_ROWS,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': 'rgba(4,9,44,0)',
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
            ['boolean', ['feature-state', 'selected'], false], overlays.row.selectedOutline,
            'rgba(0,0,0,0)',
          ],
          'line-width': 1.5,
        },
      },

      // 9. Row outline — borders between rows.
      // Production: line-color is sectionNoInventoryFill (#E3E3E8).
      // Hides on selected row so the stroke doesn't darken against the overlay tint.
      {
        id: LAYER_ROW_OUTLINE,
        type: 'line',
        source: SOURCE_ROWS,
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], 'rgba(0,0,0,0)',
            rowStrokeColor,
          ],
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
          'line-width': 1,
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
          'line-color': overlays.section.selectedOutline,
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

      // 12a. Seat connectors — lines connecting consecutive seats in a listing.
      // Rendered below seat circles so the line doesn't intersect through them.
      // Dynamic source populated at runtime. Feature-state driven color.
      {
        id: LAYER_SEAT_CONNECTOR,
        type: 'line',
        source: SOURCE_SEAT_CONNECTORS,
        layout: {
          visibility: 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false], seatColors.connectorSelected,
            ['boolean', ['feature-state', 'hovered'], false], seatColors.connectorHover,
            ['boolean', ['feature-state', 'unavailable'], false], 'rgba(4,9,44,0)',
            seatColors.connector,
          ],
          'line-width': CONNECTOR_WIDTH_EXPR,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'unavailable'], false], 0,
            1,
          ],
        },
      },

      // 12a-ii. Seat connector muted overlay — white wash on connectors outside selected section.
      // Filter-driven, mirrors LAYER_SEAT_MUTED_OVERLAY behavior.
      {
        id: LAYER_SEAT_CONNECTOR_MUTED_OVERLAY,
        type: 'line',
        source: SOURCE_SEAT_CONNECTORS,
        filter: ['==', ['get', 'sectionId'], ''],  // matches nothing until filter is set
        layout: {
          visibility: 'none',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
            ['boolean', ['feature-state', 'selected'], false], 'rgba(4,9,44,0)',
            overlays.seat.muted,
          ],
          'line-width': CONNECTOR_WIDTH_EXPR,
        },
      },

      // 12b. Seats — prototype-only circle layer (production stops at row level).
      {
        id: LAYER_SEAT,
        type: 'circle',
        source: SOURCE_SEATS,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': sectionFillColor,
          'circle-radius': SEAT_RADIUS_EXPR,
          'circle-stroke-width': 0,
        },
      },

      // 12c. Seat interaction layer — larger invisible hover target for pointer forgiveness.
      {
        id: LAYER_SEAT_INTERACTION,
        type: 'circle',
        source: SOURCE_SEATS,
        layout: { visibility: 'none' },
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': SEAT_INTERACTION_RADIUS_EXPR,
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
            ['boolean', ['feature-state', 'hovered'], false], overlays.seat.hover,
            'rgba(0,0,0,0)',
          ],
          'circle-radius': SEAT_RADIUS_EXPR,
        },
      },

      // 13b. Seat muted overlay — white wash on seats outside the selected section.
      // Filter-driven (like section-selected-overlay): filter updated imperatively in MapLibreVenue.
      // Layer hidden when no selection or not in seats mode.
      {
        id: LAYER_SEAT_MUTED_OVERLAY,
        type: 'circle',
        source: SOURCE_SEATS,
        filter: ['==', ['get', 'sectionId'], ''],  // matches nothing until filter is set
        layout: { visibility: 'none' },
        paint: {
          'circle-color': [
            'case',
            ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
            ['boolean', ['feature-state', 'selected'], false], 'rgba(4,9,44,0)',
            overlays.seat.muted,
          ],
          'circle-radius': SEAT_RADIUS_EXPR,
        },
      },

      // 13c. Seat selected overlay — dark tint + outline ring on selected row's seats (filter-driven).
      // Uses a sectionId+rowId filter (like section-selected-outline) so it works whether a row
      // listing or an individual seat is selected — no per-seat feature-state required.
      {
        id: LAYER_SEAT_SELECTED_OVERLAY,
        type: 'circle',
        source: SOURCE_SEATS,
        filter: ['all', ['==', ['get', 'sectionId'], ''], ['==', ['get', 'rowId'], '']],
        layout: { visibility: 'none' },
        paint: {
          'circle-color': overlays.seat.selected,
          'circle-radius': SEAT_RADIUS_EXPR,
          'circle-stroke-color': overlays.seat.selectedOutline,
          'circle-stroke-width': [
            'interpolate', ['exponential', 2], ['zoom'],
            14, 2,
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
