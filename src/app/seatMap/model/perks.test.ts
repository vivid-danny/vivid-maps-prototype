import { describe, expect, it } from 'vitest';
import { isAisleListing } from './perks';

describe('isAisleListing', () => {
  it('marks a single first seat as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s1'], rowSeatCount: 6 })).toBe(true);
  });

  it('marks a single last seat as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s6'], rowSeatCount: 6 })).toBe(true);
  });

  it('does not mark a middle seat as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s3'], rowSeatCount: 6 })).toBe(false);
  });

  it('marks a multi-seat block containing the first seat as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s1', '1:10:s2', '1:10:s3'], rowSeatCount: 6 })).toBe(true);
  });

  it('marks a multi-seat block containing the last seat as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s4', '1:10:s5', '1:10:s6'], rowSeatCount: 6 })).toBe(true);
  });

  it('does not mark a middle block as aisle', () => {
    expect(isAisleListing({ seatIds: ['1:10:s2', '1:10:s3', '1:10:s4'], rowSeatCount: 6 })).toBe(false);
  });

  it('returns false for malformed seat ids', () => {
    expect(isAisleListing({ seatIds: ['bad-seat-id'], rowSeatCount: 6 })).toBe(false);
  });

  it('supports rows with normalized row ids', () => {
    expect(isAisleListing({ seatIds: ['76:1a:s1'], rowSeatCount: 3 })).toBe(true);
  });
});
