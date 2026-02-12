// Shared dimension constants for seat map rendering
// All values are even numbers to avoid sub-pixel rendering issues

export const SEAT_SIZE = 4;  // 4x4 px seats (center at 2px - whole pixel)
export const SEAT_GAP = 2;   // 2px horizontal gap between seats
export const ROW_GAP = 2;    // 2px vertical gap between rows
export const PADDING = 1;    // 1px padding to prevent edge clipping

// Content dimensions (without padding)
const getContentWidth = (seatCount: number) =>
  seatCount * SEAT_SIZE + (seatCount - 1) * SEAT_GAP;

const getContentHeight = (rowCount: number) =>
  rowCount * SEAT_SIZE + (rowCount - 1) * ROW_GAP;

// SVG dimensions (with padding on all sides)
export const getSeatRowWidth = (seatCount: number) =>
  getContentWidth(seatCount) + PADDING * 2;

export const getSectionHeight = (rowCount: number) =>
  getContentHeight(rowCount) + PADDING * 2;

// Center position of a seat given its row and seat indices
export function getSeatCenter(rowIndex: number, seatIndex: number): { cx: number; cy: number } {
  return {
    cx: PADDING + seatIndex * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2,
    cy: PADDING + rowIndex * (SEAT_SIZE + ROW_GAP) + SEAT_SIZE / 2,
  };
}

// Zoom-based display mode switching
export const ZOOM_THRESHOLD = 5;  // Scale at which display mode switches
