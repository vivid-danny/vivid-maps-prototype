// Source IDs
export const SOURCE_SECTIONS = 'sections';
export const SOURCE_ROWS = 'rows';
export const SOURCE_SEATS = 'seats';

// Layer IDs — sections
export const LAYER_SECTION_FILL = 'section-fill';
export const LAYER_SECTION_STROKE = 'section-stroke'; // width 0, kept for filter/visibility toggling
export const LAYER_SECTION_LABEL = 'section-label';

// Layer IDs — rows
export const LAYER_ROW_FILL = 'row-fill';

// Layer IDs — seats
export const LAYER_SEAT = 'seat';

// Zoom thresholds calibrated for synthetic lat/lng (~0,0) coordinates.
// Initial fitBounds zoom is ~13.9 for this venue, so thresholds must be above that.
export const SECTION_ZOOM_MAX = 14;  // sections fade out above this
export const ROW_ZOOM_MIN = 14;      // rows fade in above this
export const ROW_ZOOM_MAX = 17;      // rows fade out above this (unused currently)
export const SEAT_ZOOM_MIN = 16;     // seats appear above this

// Venue coordinate bounds  [[lngMin, latMin], [lngMax, latMax]]
export const VENUE_BOUNDS: [[number, number], [number, number]] = [
  [0.0003165, -0.072575],
  [0.0985706, -0.0010108],
];

export const VENUE_CENTER: [number, number] = [0.049443549999999996, -0.0367929];

// Background image corners (from manifest images[0].coordinates): TL, TR, BR, BL
export const BACKGROUND_COORDINATES: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0],
  [0.1, 0],
  [0.1, -0.0727997],
  [0, -0.0727997],
];

// Glyphs for section labels
export const GLYPHS_URL = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';
