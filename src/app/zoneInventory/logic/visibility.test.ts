import { describe, expect, it } from 'vitest';
import { ZONE_LISTINGS } from '../data/listings';
import {
  buildPanelModel,
  displayRow,
  zoneShapeIds,
  zoneSiblingShapeIds,
} from './visibility';
import type { Filters, ZoneListing } from '../types';

const NO_FILTER: Filters = { quantity: 1, priceMin: 0, priceMax: Number.MAX_SAFE_INTEGER };

const ids = (listings: ZoneListing[]) => listings.map((l) => l.listingId);

describe('zone-matched gate', () => {
  it('never shows a listing that matches no zone, with or without a selection', () => {
    const unmatched = ZONE_LISTINGS.filter((l) => l.zoneId === null);
    expect(unmatched.length).toBeGreaterThan(0);

    const none = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER);
    expect(none.all!.some((l) => l.zoneId === null)).toBe(false);

    // "AU4" with no zone must not ride along when a real AU4 shape is selected.
    for (const shapeId of ['AU4-SU', 'AU4-VIP']) {
      const model = buildPanelModel(ZONE_LISTINGS, [shapeId], NO_FILTER);
      const shown = [...(model.exact?.listings ?? []), ...(model.alsoInZone?.listings ?? [])];
      expect(shown.some((l) => l.zoneId === null)).toBe(false);
    }
  });
});

describe('no selection', () => {
  it('shows every zone-matched listing in one flat list sorted by price', () => {
    const model = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER);
    const expected = ZONE_LISTINGS.filter((l) => l.zoneId !== null).length;
    expect(model.all).toHaveLength(expected);
    expect(model.exact).toBeNull();
    expect(model.alsoInZone).toBeNull();
    expect(model.resultsHeader).toEqual({ count: `${expected} listings`, detail: null });
    const prices = model.all!.map((l) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('single section selected', () => {
  const model = buildPanelModel(ZONE_LISTINGS, ['119'], NO_FILTER);

  it('puts only that section in Tier 1', () => {
    expect(model.exact!.listings.every((l) => l.shapeId === '119')).toBe(true);
    expect(model.exact!.header).toEqual({ count: '9 listings', detail: 'in Section 119' });
  });

  it('puts the rest of the zone — section-less and other sections — in Tier 2', () => {
    const tier2 = model.alsoInZone!.listings;
    expect(tier2.length).toBeGreaterThan(0);
    expect(tier2.every((l) => l.zoneId === 'longside-lower-central')).toBe(true);
    expect(tier2.every((l) => l.shapeId !== '119')).toBe(true);
    expect(tier2.some((l) => l.shapeId === null)).toBe(true);
    expect(tier2.some((l) => l.shapeId !== null)).toBe(true);
    expect(model.alsoInZone!.header).toEqual({
      count: `${tier2.length} listings`,
      detail: 'in Longside Lower Central',
    });
  });

  it('counts everything visible in the results header', () => {
    expect(model.resultsHeader).toEqual({
      count: '9 listings',
      detail: 'in Section 119',
    });
  });

  it('hides listings from untouched zones', () => {
    const shown = [...model.exact!.listings, ...model.alsoInZone!.listings];
    expect(shown.some((l) => l.zoneId === 'vip')).toBe(false);
  });
});

describe('thin and empty sections', () => {
  it('keeps a 2-listing section usable', () => {
    const model = buildPanelModel(ZONE_LISTINGS, ['122'], NO_FILTER);
    expect(model.exact!.listings).toHaveLength(2);
    expect(model.exact!.header).toEqual({ count: '2 listings', detail: 'in Section 122' });
    expect(model.alsoInZone!.listings.length).toBeGreaterThan(10);
  });

  it('never dead-ends an empty section that sits in a stocked zone', () => {
    const model = buildPanelModel(ZONE_LISTINGS, ['121'], NO_FILTER);
    // No standalone "empty section" copy: the header already reads "0 listings
    // in Section 121", and the zone group below is what keeps it from dead-ending.
    expect(model.exact).toBeNull();
    expect(model.alsoInZone!.listings.length).toBeGreaterThan(0);
    expect(model.resultsHeader).toEqual({
      count: '0 listings',
      detail: 'in Section 121',
    });
  });
});

describe('multi-select', () => {
  it('treats every selected section in one zone as Tier 1', () => {
    const model = buildPanelModel(ZONE_LISTINGS, ['119', '122'], NO_FILTER);
    expect(model.exact!.listings).toHaveLength(11);
    expect(model.exact!.header).toEqual({ count: '11 listings', detail: 'in Sections 119, 122' });
    expect(model.alsoInZone!.header.detail).toBe('in Longside Lower Central');
  });

  it('merges the remainder of every touched zone into one Tier 2 group', () => {
    const model = buildPanelModel(ZONE_LISTINGS, ['119', 'AL3'], NO_FILTER);
    const tier2 = model.alsoInZone!.listings;
    const zones = new Set(tier2.map((l) => l.zoneId));
    expect(zones).toEqual(new Set(['longside-lower-central', 'shortside-lower']));
    expect(model.alsoInZone!.header).toEqual({
      count: `${tier2.length} listings`,
      detail: 'in these zones',
    });
    expect(model.exact!.header).toEqual({ count: '10 listings', detail: 'in Sections 119, AL3' });
  });
});

describe('a section split between two zones', () => {
  it('scopes Tier 2 to the selected half of AU4', () => {
    const vip = buildPanelModel(ZONE_LISTINGS, ['AU4-VIP'], NO_FILTER);
    expect(vip.exact!.listings.every((l) => l.shapeId === 'AU4-VIP')).toBe(true);
    expect(vip.exact!.header).toEqual({ count: '1 listing', detail: 'in Section AU4' });
    expect(vip.alsoInZone!.listings.every((l) => l.zoneId === 'vip')).toBe(true);
    // The Shortside Upper half of AU4 belongs to a different zone.
    expect(ids(vip.alsoInZone!.listings)).not.toContain(
      ZONE_LISTINGS.find((l) => l.shapeId === 'AU4-SU')!.listingId,
    );

    const su = buildPanelModel(ZONE_LISTINGS, ['AU4-SU'], NO_FILTER);
    expect(su.alsoInZone!.listings.every((l) => l.zoneId === 'shortside-upper')).toBe(true);
  });
});

describe('sort', () => {
  it('orders each tier on its own and never interleaves them', () => {
    for (const sortBy of ['price', 'dealScore'] as const) {
      const model = buildPanelModel(ZONE_LISTINGS, ['119'], NO_FILTER, sortBy);
      const tier1 = model.exact!.listings;
      const tier2 = model.alsoInZone!.listings;

      // Tier 1 is still only the selected section, whatever the sort.
      expect(tier1.every((l) => l.shapeId === '119')).toBe(true);
      expect(tier2.every((l) => l.shapeId !== '119')).toBe(true);

      for (const group of [tier1, tier2]) {
        const keys = group.map((l) => (sortBy === 'price' ? l.price : -l.dealScore));
        expect(keys).toEqual([...keys].sort((a, b) => a - b));
      }
    }
  });

  it('actually reorders — deal score is not just price again', () => {
    const byPrice = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER, 'price');
    const byDeal = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER, 'dealScore');
    expect(ids(byDeal.all!)).not.toEqual(ids(byPrice.all!));
    expect(byDeal.all).toHaveLength(byPrice.all!.length);
  });
});

describe('filters', () => {
  it('applies quantity and price range to both groups', () => {
    const filters: Filters = { quantity: 4, priceMin: 0, priceMax: 60_000 };
    const model = buildPanelModel(ZONE_LISTINGS, ['119'], filters);
    const shown = [...(model.exact?.listings ?? []), ...(model.alsoInZone?.listings ?? [])];
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((l) => l.quantity >= 4 && l.price <= 60_000)).toBe(true);
  });
});

describe('map support', () => {
  it('tints every other section in each touched zone, including far-side ones', () => {
    const siblings = zoneSiblingShapeIds(['119']);
    expect(siblings).toContain('122');
    // Non-contiguous: 103-105 sit on the opposite stand.
    expect(siblings).toContain('103');
    expect(siblings).not.toContain('119');
    expect(siblings).not.toContain('219');
  });

});

describe('unreliable rows', () => {
  it('hides placeholder rows', () => {
    expect(displayRow('***')).toBeNull();
    expect(displayRow('N/A')).toBeNull();
    expect(displayRow('tbc')).toBeNull();
    expect(displayRow('TBD')).toBeNull();
    expect(displayRow(null)).toBeNull();
    expect(displayRow('12')).toBe('12');
  });
});

describe('zone picked from the chips', () => {
  it('scopes the list to the zone as one flat group, not two tiers', () => {
    const model = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER, 'price', [
      'longside-lower-central',
    ]);

    // Flat: tiering separates "the section you picked" from the rest of its
    // zone, and when the zone IS the pick there is no remainder to separate.
    expect(model.exact).toBeNull();
    expect(model.alsoInZone).toBeNull();
    expect(model.all).not.toBeNull();
    expect(model.all!.every((l) => l.zoneId === 'longside-lower-central')).toBe(true);
    expect(model.all!.length).toBe(model.totalVisible);
    expect(model.resultsHeader).toEqual({
      count: `${model.totalVisible} listings`,
      detail: 'in Longside Lower Central',
    });
  });

  it('merges several picked zones under one header', () => {
    const model = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER, 'price', ['vip', 'shortside-lower']);
    const zones = new Set(model.all!.map((l) => l.zoneId));
    expect(zones).toEqual(new Set(['vip', 'shortside-lower']));
    expect(model.resultsHeader.detail).toBe('in these zones');
  });

  it('includes both sectioned and zone-only inventory from the zone', () => {
    const model = buildPanelModel(ZONE_LISTINGS, [], NO_FILTER, 'price', [
      'longside-lower-central',
    ]);
    expect(model.all!.some((l) => l.shapeId !== null)).toBe(true);
    expect(model.all!.some((l) => l.shapeId === null)).toBe(true);
  });

  it('yields to an explicit section selection', () => {
    // A zone and a section inside it are competing answers to "where", so the
    // root clears one when the other is set; the model honours sections first.
    const model = buildPanelModel(ZONE_LISTINGS, ['119'], NO_FILTER, 'price', [
      'longside-lower-central',
    ]);
    expect(model.all).toBeNull();
    expect(model.exact!.header).toEqual({ count: '9 listings', detail: 'in Section 119' });
  });
});

describe('zoneShapeIds', () => {
  it('returns every shape in the given zones', () => {
    const vip = zoneShapeIds(['vip']);
    expect(vip).toContain('VIP1');
    expect(vip).toContain('VIP2');
    expect(vip).toContain('AU4-VIP');
    // AU4 is split between two zones, so only the VIP half belongs here.
    expect(vip).not.toContain('AU4-SU');
  });

  it('is the superset the sibling helper subtracts the selection from', () => {
    const all = zoneShapeIds(['longside-lower-central']);
    const siblings = zoneSiblingShapeIds(['119']);
    expect(all).toContain('119');
    expect(siblings).not.toContain('119');
    expect(new Set(siblings)).toEqual(new Set(all.filter((id) => id !== '119')));
  });
});
