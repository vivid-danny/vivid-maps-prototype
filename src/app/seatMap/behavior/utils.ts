// Shared utility functions

// Darken a hex color by a fraction (0 = no change, 1 = black)
export function darkenHex(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Lighten a hex color by a percentage (0 = no change, 100 = white)
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * (percent / 100)));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * (percent / 100)));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * (percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Simple string hash function for deterministic seed generation
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Parse a seatId of format "{sectionId}{rowNum}-{seatNum}" (e.g. "B3-5")
// Returns rowId (everything before dash) and seatNumber (after dash)
export function parseSeatId(seatId: string): { rowId: string; seatNumber: number } | null {
  const dashIndex = seatId.lastIndexOf('-');
  if (dashIndex <= 0) return null;
  const seatNumber = parseInt(seatId.substring(dashIndex + 1), 10);
  if (isNaN(seatNumber)) return null;
  return { rowId: seatId.substring(0, dashIndex), seatNumber };
}

// Parse a seatId matching the strict pattern "{LETTERS}{rowNum}-{seatNum}" (e.g. "B3-5")
// Returns numeric row and seat values. Used in generateSectionData where section IDs are uppercase letters.
const SEAT_ID_RE = /^[A-Z]+(\d+)-(\d+)$/;

export function parseSeatIdNums(seatId: string): { rowNum: number; seatNum: number } | null {
  const match = seatId.match(SEAT_ID_RE);
  if (!match) return null;
  return { rowNum: parseInt(match[1], 10), seatNum: parseInt(match[2], 10) };
}
