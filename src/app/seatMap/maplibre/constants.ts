// Source IDs
export const SOURCE_SECTIONS = 'sections';
export const SOURCE_ROWS = 'rows';
export const SOURCE_SEATS = 'seats';
export const SOURCE_SECTION_LABELS = 'section-labels';

// Layer IDs — sections (aligned with production styleJSONv2.ts)
export const LAYER_SECTION_BASE = 'section-base';
export const LAYER_SECTION = 'section';
export const LAYER_SECTION_SELECTED_OVERLAY = 'section-selected-overlay';
export const LAYER_SECTION_OUTLINE = 'section-outline';
export const LAYER_SECTION_SELECTED_OUTLINE = 'section-selected-outline';
export const LAYER_SECTION_LABEL = 'section-label';

// Layer IDs — rows
export const LAYER_ROW = 'row';
export const LAYER_ROW_SELECTED_OVERLAY = 'row-selected-overlay';
export const LAYER_ROW_OUTLINE = 'row-outline';
export const LAYER_ROW_LABEL = 'row-label';

// Layer IDs — seats (prototype-only; production stops at rows)
export const LAYER_SEAT = 'seat';

// Zoom thresholds calibrated for synthetic lat/lng (~0,0) coordinates.
// Prototype zoom ≈ production zoom + 8 (production uses 6-12 range).
// Initial fitBounds zoom is ~13.9 for this venue, so thresholds must be above that.
export const SECTION_ZOOM_MAX = 14;  // sections fade out above this
export const ROW_ZOOM_MIN = 14;      // rows fade in above this
export const ROW_ZOOM_MAX = 17;      // rows fade out above this (unused currently)
export const SEAT_ZOOM_MIN = 16;     // seats appear above this

/**
 * Production DEFAULT_COLORS (mobile: Mapbox/constants.ts)
 * See Confluence: "Style JSON Breakdown" → Constants → Colors
 */
export const STYLE_COLORS = {
  textColor: '#04092C',
  textHaloColor: 'hsla(0, 0%, 100%, 0.15)',
  textHaloWidth: 2,
  sectionStrokeColor: '#04092C',
  sectionNoInventoryFill: '#E3E3E8',
  muted: 'rgba(255, 255, 255, 0.5)',
  selected: 'rgba(4, 9, 44, 0.4)',
  transparent: 'rgba(0, 0, 0, 0)',
} as const;

/**
 * Production theme tokens (mobile: useVSTheme)
 * See Confluence: "Style JSON Breakdown" → Constants → Theme-Based Colors
 */
export const THEME_TOKENS = {
  background: '#F6F6FB',       // neutral[50]
  venueFill: '#FFFFFF',         // onPrimary
  venueStroke: '#A0A2B3',       // onSurfaceDisabled
  sectionBase: '#EFEFF6',       // neutral[100]
} as const;

// Venue coordinate bounds  [[lngMin, latMin], [lngMax, latMax]]
export const VENUE_BOUNDS: [[number, number], [number, number]] = [
  [0.0003165, -0.072575],
  [0.0985706, -0.0010108],
];

export const VENUE_CENTER: [number, number] = [0.049443549999999996, -0.0367929];

// Rink image corners: TL, TR, BR, BL (derived from rink_cropped frame in Figma background_updated)
export const RINK_COORDINATES: [[number, number], [number, number], [number, number], [number, number]] = [
  [0.03222217559814453, -0.02913394134170256],
  [0.06850147247314453, -0.02913394134170256],
  [0.06850147247314453, -0.044367681381944],
  [0.03222217559814453, -0.044367681381944],
];

// Glyphs for section labels
export const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';
