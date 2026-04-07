const SEAT_FEATURE_ROW_ID_OVERRIDES = new Map<string, string>([
  ['76:1A', '1a'],
  ['320:EAU', 'eau'],
  ['336:EAU', 'eau'],
  ['338:EAU', 'eau'],
  ['348:EAU', 'eau'],
  ['356:EAU', 'eau'],
  ['364:EAU', 'eau'],
  ['372:EAU', 'eau'],
]);

export function buildRowFeatureId(sectionId: string, rowId: string): string {
  return `${sectionId}:${rowId}`;
}

export function normalizeSeatFeatureRowId(sectionId: string, rowId: string): string {
  return SEAT_FEATURE_ROW_ID_OVERRIDES.get(buildRowFeatureId(sectionId, rowId)) ?? rowId;
}

export function buildSeatFeatureId(
  sectionId: string,
  rowId: string,
  seatNumber: number,
): string {
  return `${sectionId}:${normalizeSeatFeatureRowId(sectionId, rowId)}:s${seatNumber}`;
}

export function parseSeatFeatureId(
  seatId: string,
): { sectionId: string; rowId: string; seatNumber: number } | null {
  const parts = seatId.split(':');
  if (parts.length !== 3) return null;

  const [sectionId, rowId, seatPart] = parts;
  if (!sectionId || !rowId || !seatPart.startsWith('s')) return null;

  const seatNumber = parseInt(seatPart.slice(1), 10);
  if (Number.isNaN(seatNumber)) return null;

  return { sectionId, rowId, seatNumber };
}
