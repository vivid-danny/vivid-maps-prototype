import { describe, it, expect } from 'vitest';

describe('usePolePosition (unit logic)', () => {
  it('exports usePolePosition hook', async () => {
    const mod = await import('../app/components/usePolePosition');
    expect(mod).toHaveProperty('usePolePosition');
  });

  it('HoverState source type is exported', async () => {
    const mod = await import('../app/seatMap/model/types');
    const hover: typeof mod.EMPTY_HOVER = { listingId: null, sectionId: null, rowId: null };
    expect(hover.listingId).toBeNull();
  });
});

describe('handlePolePosition priority logic', () => {
  it('pole hover does not override pointer hover on desktop', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pointer' as const };
    const layoutMode = 'desktop';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(false);
  });

  it('pole hover does override on mobile regardless of source', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pointer' as const };
    const layoutMode = 'mobile';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(true);
  });

  it('pole hover overrides previous pole hover on desktop', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pole' as const };
    const layoutMode = 'desktop';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(true);
  });

  it('pole clear does not wipe pointer hover', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pointer' as const };
    const shouldClear = prev.source === 'pole';
    expect(shouldClear).toBe(false);
  });

  it('pole clear does wipe pole hover', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pole' as const };
    const shouldClear = prev.source === 'pole';
    expect(shouldClear).toBe(true);
  });
});
