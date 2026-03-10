import type { VenueGeometry, VenueSeatMapModel } from '../seatMap/mock/createVenueSeatMapModel';
import type { DisplayMode, Listing, SelectionState } from '../seatMap/model/types';
import type { HoverPinTarget } from '../seatMap/behavior/pins';
import { parseSeatId } from '../seatMap/behavior/utils';

export interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Seat size in venue coordinate space
export const SEAT_RADIUS = 6;

// Padding around viewport for culling (in venue coords)
const CULL_PADDING = 300;

export function computeVisibleSections(
  geometry: VenueGeometry,
  viewport: ViewportRect | null,
): Set<string> | null {
  if (!viewport) return null; // show all if no viewport yet

  const visible = new Set<string>();
  for (const [sectionId, boundary] of geometry.sectionBoundaries) {
    const sx = boundary.bx - CULL_PADDING;
    const sy = boundary.by - CULL_PADDING;
    const sw = boundary.bw + CULL_PADDING * 2;
    const sh = boundary.bh + CULL_PADDING * 2;

    // AABB intersection
    if (sx + sw > viewport.x && sx < viewport.x + viewport.w &&
        sy + sh > viewport.y && sy < viewport.y + viewport.h) {
      visible.add(sectionId);
    }
  }

  return visible;
}

// Resolve venue-coordinate position for a pin target
export function resolveTargetPosition(
  target: HoverPinTarget,
  geometry: VenueGeometry,
): { x: number; y: number } | null {
  const sectionId = target.listing.sectionId;

  if (target.kind === 'section') {
    const boundary = geometry.sectionBoundaries.get(sectionId);
    if (!boundary) return null;
    return { x: boundary.bx + boundary.bw / 2, y: boundary.by + boundary.bh / 2 };
  }

  const seatRows = geometry.seatPositions.get(sectionId);
  if (!seatRows) return null;

  if (target.kind === 'row') {
    const row = seatRows[target.rowIndex];
    if (!row || row.length === 0) return null;
    const midSeat = Math.floor(row.length / 4); // row.length/2 seats, half of that for middle
    return { x: row[midSeat * 2], y: row[midSeat * 2 + 1] };
  }

  // kind === 'seat'
  const row = seatRows[target.rowIndex];
  if (!row || row.length === 0) return null;
  const seatIdx = Math.max(0, Math.min(target.seatIndex, row.length / 2 - 1));
  return { x: row[seatIdx * 2], y: row[seatIdx * 2 + 1] - SEAT_RADIUS };
}

// Resolve the row index (0-based) from a rowId, given its sectionId.
// rowId format: "{sectionId}-{rowNum}" (e.g. "14-3" → rowIndex 2)
function resolveRowIndex(rowId: string, sectionId: string): number | null {
  const prefix = sectionId + '-';
  if (!rowId.startsWith(prefix)) return null;
  const rowNum = parseInt(rowId.slice(prefix.length), 10);
  if (isNaN(rowNum)) return null;
  return rowNum - 1;
}

// Resolve the venue-coordinate center of a SelectionState (seat → row → section fallback)
export function resolveSelectionCenter(
  sel: SelectionState,
  geometry: VenueGeometry,
): { x: number; y: number } | null {
  if (!sel.sectionId) return null;
  const sectionId = sel.sectionId;

  // Try seat level
  if (sel.seatIds.length > 0) {
    const midSeatId = sel.seatIds[Math.floor(sel.seatIds.length / 2)];
    if (midSeatId) {
      const parsed = parseSeatId(midSeatId);
      if (parsed) {
        const rowIndex = resolveRowIndex(parsed.rowId, sectionId);
        if (rowIndex !== null) {
          const seatRows = geometry.seatPositions.get(sectionId);
          const row = seatRows?.[rowIndex];
          if (row && row.length > 0) {
            const seatIdx = Math.max(0, Math.min(parsed.seatNumber - 1, row.length / 2 - 1));
            return { x: row[seatIdx * 2], y: row[seatIdx * 2 + 1] };
          }
        }
      }
    }
  }

  // Try row level
  if (sel.rowId) {
    const rowIndex = resolveRowIndex(sel.rowId, sectionId);
    if (rowIndex !== null) {
      const seatRows = geometry.seatPositions.get(sectionId);
      const row = seatRows?.[rowIndex];
      if (row && row.length > 0) {
        const midSeat = Math.floor(row.length / 4); // row.length/2 seats; pick middle
        return { x: row[midSeat * 2], y: row[midSeat * 2 + 1] };
      }
    }
  }

  // Fallback: section center
  const boundary = geometry.sectionBoundaries.get(sectionId);
  if (!boundary) return null;
  return { x: boundary.bx + boundary.bw / 2, y: boundary.by + boundary.bh / 2 };
}

// Build a HoverPinTarget from a selected listing for overlay pin positioning
export function buildSelectedPinTarget(
  listing: Listing,
  displayMode: DisplayMode,
  model: VenueSeatMapModel,
): HoverPinTarget | null {
  if (displayMode === 'sections') {
    return { kind: 'section', listing };
  }

  const rowIndex = listing.rowNumber - 1;

  if (displayMode === 'rows') {
    return { kind: 'row', listing, rowIndex };
  }

  // seats mode: zone/unmapped → row center, otherwise specific seat
  const sectionData = model.sectionDataById.get(listing.sectionId);
  const row = sectionData?.rows.find(r => r.rowId === listing.rowId);
  if (row?.isZoneRow || listing.isUnmapped) {
    return { kind: 'row', listing, rowIndex };
  }

  const middleSeatId = listing.seatIds[Math.floor(listing.seatIds.length / 2)];
  const seatIndex = middleSeatId ? (parseSeatId(middleSeatId)?.seatNumber ?? 1) - 1 : 0;
  return { kind: 'seat', listing, rowIndex, seatIndex };
}
