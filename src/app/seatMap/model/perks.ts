import { parseSeatFeatureId } from './ids';

interface AisleSeatParams {
  seatIds: string[];
  rowSeatCount: number;
}

export function isAisleListing({ seatIds, rowSeatCount }: AisleSeatParams): boolean {
  if (rowSeatCount < 1) return false;

  return seatIds.some((seatId) => {
    const parsed = parseSeatFeatureId(seatId);
    if (!parsed) return false;
    return parsed.seatNumber === 1 || parsed.seatNumber === rowSeatCount;
  });
}
