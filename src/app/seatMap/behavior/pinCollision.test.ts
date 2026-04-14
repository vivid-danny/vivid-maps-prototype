import { describe, expect, it } from 'vitest';
import { computeCollisionHiddenPins, type ScreenPin } from './pinCollision';

function pin(overrides: Partial<ScreenPin> & { id: string }): ScreenPin {
  return {
    screenX: 0,
    screenY: 0,
    isSelected: false,
    isHovered: false,
    dealScore: 5,
    price: 100,
    ...overrides,
  };
}

describe('computeCollisionHiddenPins', () => {
  it('returns empty set for empty input', () => {
    expect(computeCollisionHiddenPins([], 60)).toEqual(new Set());
  });

  it('returns empty set for a single pin', () => {
    expect(computeCollisionHiddenPins([pin({ id: 'a' })], 60)).toEqual(new Set());
  });

  it('hides nothing when pins are far apart', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0 }),
      pin({ id: 'b', screenX: 200, screenY: 200 }),
    ];
    expect(computeCollisionHiddenPins(pins, 60)).toEqual(new Set());
  });

  it('hides lower-priority pin when two overlap', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 8 }),
      pin({ id: 'b', screenX: 10, screenY: 10, dealScore: 5 }),
    ];
    expect(computeCollisionHiddenPins(pins, 60)).toEqual(new Set(['b']));
  });

  it('uses price as tiebreaker when dealScore is equal', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 5, price: 200 }),
      pin({ id: 'b', screenX: 10, screenY: 10, dealScore: 5, price: 100 }),
    ];
    expect(computeCollisionHiddenPins(pins, 60)).toEqual(new Set(['a']));
  });

  it('never hides a selected pin', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 10 }),
      pin({ id: 'b', screenX: 5, screenY: 5, isSelected: true, dealScore: 1 }),
    ];
    const hidden = computeCollisionHiddenPins(pins, 60);
    expect(hidden.has('b')).toBe(false);
    expect(hidden.has('a')).toBe(true);
  });

  it('never hides a hovered pin', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 10 }),
      pin({ id: 'b', screenX: 5, screenY: 5, isHovered: true, dealScore: 1 }),
    ];
    const hidden = computeCollisionHiddenPins(pins, 60);
    expect(hidden.has('b')).toBe(false);
    expect(hidden.has('a')).toBe(true);
  });

  it('chain collision: C survives when only B (hidden) was near it', () => {
    // A at origin, B at 30px (hidden by A), C at 55px from B but 85px from A
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 10 }),
      pin({ id: 'b', screenX: 30, screenY: 0, dealScore: 5 }),
      pin({ id: 'c', screenX: 85, screenY: 0, dealScore: 3 }),
    ];
    const hidden = computeCollisionHiddenPins(pins, 60);
    expect(hidden).toEqual(new Set(['b']));
  });

  it('selected pin takes priority over higher dealScore', () => {
    const pins = [
      pin({ id: 'a', screenX: 0, screenY: 0, dealScore: 10, isSelected: true }),
      pin({ id: 'b', screenX: 5, screenY: 5, dealScore: 10 }),
    ];
    const hidden = computeCollisionHiddenPins(pins, 60);
    expect(hidden).toEqual(new Set(['b']));
  });
});
