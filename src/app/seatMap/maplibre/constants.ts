// Source IDs
export const SOURCE_SECTIONS = 'sections';
export const SOURCE_ROWS = 'rows';
export const SOURCE_SEATS = 'seats';
export const SOURCE_SECTION_LABELS = 'section-labels';

// Layer IDs — sections (aligned with production styleJSONv2.ts)
export const LAYER_SECTION_BASE = 'section-base';
export const LAYER_SECTION = 'section';
export const LAYER_SECTION_HOVER_OVERLAY = 'section-hover-overlay';
export const LAYER_SECTION_SELECTED_OVERLAY = 'section-selected-overlay';
export const LAYER_SECTION_OUTLINE = 'section-outline';
export const LAYER_SECTION_SELECTED_OUTLINE = 'section-selected-outline';
export const LAYER_SECTION_LABEL = 'section-label';

// Layer IDs — rows
export const LAYER_ROW = 'row';
export const LAYER_ROW_HOVER_OVERLAY = 'row-hover-overlay';
export const LAYER_ROW_SELECTED_OVERLAY = 'row-selected-overlay';
export const LAYER_ROW_SELECTED_OUTLINE = 'row-selected-outline';
export const LAYER_ROW_OUTLINE = 'row-outline';
export const LAYER_ROW_LABEL = 'row-label';

// Layer IDs — seats (prototype-only; production stops at rows)
export const LAYER_SEAT = 'seat';
export const LAYER_SEAT_INTERACTION = 'seat-interaction';
export const LAYER_SEAT_CONNECTOR = 'seat-connector';
export const LAYER_SEAT_CONNECTOR_HOVER_OVERLAY = 'seat-connector-hover-overlay';
export const LAYER_SEAT_CONNECTOR_MUTED_OVERLAY = 'seat-connector-muted-overlay';
export const LAYER_SEAT_CONNECTOR_SELECTED_OVERLAY = 'seat-connector-selected-overlay';
export const LAYER_SEAT_HOVER_OVERLAY = 'seat-hover-overlay';
export const LAYER_SEAT_MUTED_OVERLAY = 'seat-muted-overlay';
export const LAYER_SEAT_SELECTED_OVERLAY = 'seat-selected-overlay';

// Source IDs — seat connectors
export const SOURCE_SEAT_CONNECTORS = 'seat-connectors';

// Grouped layer arrays — used in MapLibreVenue for batch filter/visibility operations.

/** Seat-level layers whose visibility toggles together in seats displayMode */
export const SEAT_VISIBILITY_LAYERS = [
  LAYER_SEAT,
  LAYER_SEAT_INTERACTION,
  LAYER_SEAT_CONNECTOR,
  LAYER_SEAT_CONNECTOR_HOVER_OVERLAY,
  LAYER_SEAT_CONNECTOR_SELECTED_OVERLAY,
  LAYER_SEAT_HOVER_OVERLAY,
] as const;

/** Seat + connector layers that receive the inventory filter (sectionId-based) */
export const SEAT_FILTERED_LAYERS = [
  LAYER_SEAT,
  LAYER_SEAT_INTERACTION,
  LAYER_SEAT_CONNECTOR,
  LAYER_SEAT_CONNECTOR_HOVER_OVERLAY,
  LAYER_SEAT_CONNECTOR_MUTED_OVERLAY,
  LAYER_SEAT_CONNECTOR_SELECTED_OVERLAY,
  LAYER_SEAT_HOVER_OVERLAY,
] as const;

/** Seat + connector muted overlay layers (filter + visibility toggled together) */
export const SEAT_MUTED_LAYERS = [LAYER_SEAT_MUTED_OVERLAY, LAYER_SEAT_CONNECTOR_MUTED_OVERLAY] as const;

// Zoom thresholds calibrated for synthetic lat/lng (~0,0) coordinates.
// Prototype zoom ≈ production zoom + 8 (production uses 6-12 range).
// Initial venue fit lands at ~z12.0–12.7 on desktop and ~z10.4 on mobile, so thresholds
// stay comfortably above the default view.
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

// Venue coordinate bounds  [[lngMin, latMin], [lngMax, latMax]]
export const VENUE_BOUNDS: [[number, number], [number, number]] = [
  [0.0010938, -0.0745349],
  [0.0986248, -0.0012535],
];

export const VENUE_CENTER: [number, number] = [0.0498593, -0.0378942];

/** Map rotation that straightens the venue on screen. */
export const VENUE_BEARING = -57;

/**
 * Simplified convex hull of the venue sections (lng, lat). Used by fitVenue() to fit
 * the venue's *rotated* silhouette tightly to the container — fitBounds(VENUE_BOUNDS)
 * with a bearing fits the axis-aligned bbox's rotated envelope and leaves the venue small.
 * Generated from public/sections.geojson (convex hull → Douglas-Peucker, tol 0.0003°).
 */
export const VENUE_HULL: [number, number][] = [
  [0.0976747, -0.0500200],
  [0.0986248, -0.0441876],
  [0.0981118, -0.0363772],
  [0.0938882, -0.0218184],
  [0.0848603, -0.0012535],
  [0.0376347, -0.0024251],
  [0.0245589, -0.0076747],
  [0.0010938, -0.0277705],
  [0.0010938, -0.0481816],
  [0.0191118, -0.0745349],
  [0.0632236, -0.0745349],
  [0.0702990, -0.0740649],
  [0.0767123, -0.0726352],
  [0.0844310, -0.0690813],
  [0.0907425, -0.0637625],
  [0.0952539, -0.0571861],
];


// Background image corners: TL, TR, BR, BL (from manifest images[0].coordinates)
export const BACKGROUND_IMAGE_COORDINATES: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0],
  [0.1, 0],
  [0.1, -0.075509],
  [0, -0.075509],
];

// Glyphs for section labels
export const GLYPHS_URL = '/glyphs/{fontstack}/{range}.pbf';
