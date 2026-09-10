import type { Map as MaplibreMap, PaddingOptions } from 'maplibre-gl';
import { VENUE_BEARING, VENUE_HULL } from './constants';

export type FitPadding = number | PaddingOptions;

interface FitVenueOptions {
  padding?: FitPadding;
  /** Animation duration in ms; 0 (default) jumps instantly. */
  duration?: number;
}

function normalizePadding(padding: FitPadding): Required<PaddingOptions> {
  if (typeof padding === 'number') {
    return { top: padding, bottom: padding, left: padding, right: padding };
  }
  return { top: padding.top ?? 0, bottom: padding.bottom ?? 0, left: padding.left ?? 0, right: padding.right ?? 0 };
}

/**
 * Fit the venue's rotated silhouette to the map container.
 *
 * MapLibre's fitBounds() only understands axis-aligned lng/lat boxes, so with
 * VENUE_BEARING applied it fits the bbox's rotated *envelope* and the venue
 * ends up small. This projects the venue hull through the current transform,
 * measures its on-screen bbox, and adjusts zoom/center so it fills the padded
 * container. Bearing is pinned to VENUE_BEARING.
 */
export function fitVenue(map: MaplibreMap, { padding = 0, duration = 0 }: FitVenueOptions = {}): void {
  if (map.getBearing() !== VENUE_BEARING) map.setBearing(VENUE_BEARING);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lngLat of VENUE_HULL) {
    const { x, y } = map.project(lngLat);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const venueW = maxX - minX;
  const venueH = maxY - minY;
  if (!(venueW > 0 && venueH > 0)) return;

  const pad = normalizePadding(padding);
  const container = map.getContainer();
  const availW = container.clientWidth - pad.left - pad.right;
  const availH = container.clientHeight - pad.top - pad.bottom;
  if (availW <= 0 || availH <= 0) return;

  const scale = Math.min(availW / venueW, availH / venueH);
  const zoom = map.getZoom() + Math.log2(scale);
  const center = map.unproject([(minX + maxX) / 2, (minY + maxY) / 2]);

  // `padding` shifts the camera so `center` lands in the middle of the padded area.
  const camera = { center, zoom, bearing: VENUE_BEARING, padding: pad };
  if (duration > 0) {
    map.easeTo({ ...camera, duration, essential: true });
  } else {
    map.jumpTo(camera);
  }
}
