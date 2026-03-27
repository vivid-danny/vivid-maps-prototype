# Pin Density: Declutter and Cross-Zoom Persistence

## What's Happening

In sections mode, `useMapPins` shows one pin per section unconditionally — every section in `pinsBySection` gets a candidate, and all candidates become markers. The `declutterPins` utility in `behavior/pins.ts` exists and implements a farthest-first, deal-score-seeded spatial declutter algorithm, but it's never called in the MapLibre implementation. The `pinDensity` config also isn't passed through to `useMapPins`, so the density controls in Prototype Controls are currently no-ops on the real venue map.

A second problem compounds the first: in rows mode, `useMapPins` switches to `getLowestPricePinsByRow`, showing one pin per row. This means the specific deal pin that attracted the user's attention in sections mode gets buried in a sea of per-row pins the moment they zoom in. The pin is technically still there — the section's cheapest listing is always the cheapest in its row — but it's now one of 20–30 pins and the user loses track of it.

## Goal

Two things: (1) apply spatial decluttering to sections mode so the map opens with a sparser, more evenly distributed set of ~10–20 pins; and (2) maintain that same pin in rows mode so users can follow the deal they were looking at as they zoom in.

---

## Step 1: Pass `pinDensity` through the prop chain

In `MapLibreVenue.tsx`, add a `pinDensity` prop (type `SeatMapConfig['pinDensity']`). Pass it from `SeatMapRoot.tsx` as `pinDensity={config.pinDensity}`. Forward it into `useMapPins`.

In `useMapPins`, add `pinDensity` to `UseMapPinsOptions`.

---

## Step 2: Add a MapLibre declutter distance constant

`declutterPins` computes Euclidean distances in whatever coordinate space you pass in. The existing `DECLUTTER_BASE_DISTANCE.sections` value of `100` was calibrated for the demo SVG viewport — it's meaningless for lng/lat.

In `behavior/pins.ts`, add a MapLibre-specific base distance alongside the existing one:

```ts
// Calibrated for the real venue's synthetic lng/lat space (bounds ~0.098 × 0.072).
// At sections density 0.15, minDistance = 0.018 / 0.15 = 0.12 → ~10–20 sections shown.
// Tune the numerator up/down to adjust how many pins appear at default density.
export const MAPLIBRE_DECLUTTER_BASE_DISTANCE: Record<DisplayMode, number> = {
  sections: 0.018,
  rows: 0.005,
  seats: 0.001,
};
```

These are starting values — adjust based on how many pins appear at default density. The goal is ~10–20 visible pins in sections mode at density 0.15.

---

## Step 3: Apply decluttering in `useMapPins` sections mode

In the `basePins` memo, after building all section candidates, apply `declutterPins` before pushing to `pins`. The `declutterPins` function takes `ResolvedPin[]` — wrap each candidate as:

```ts
{ pin: { listing, rowIndex: 0 }, x: lngLat[0], y: lngLat[1], sectionId }
```

Then call:

```ts
import { declutterPins, MAPLIBRE_DECLUTTER_BASE_DISTANCE } from '../behavior/pins';

// In sections mode, after collecting all candidates across all sections:
const allResolved = allSectionCandidates.map(({ listing, lngLat, sectionId }) => ({
  pin: { listing, rowIndex: 0 },
  x: lngLat[0],
  y: lngLat[1],
  sectionId,
}));
const decluttered = declutterPins(allResolved, 'sections', pinDensity.sections, isMobile);
for (const { pin, x, y, sectionId } of decluttered) {
  const isSelected = selectedListing?.listingId === pin.listing.listingId;
  pins.push({ listingId: pin.listing.listingId, lngLat: [x, y], sectionId, listing: pin.listing, isHovered: false, isSelected });
}
```

Note: the declutter needs to run across all sections together (not per-section) so the farthest-first algorithm can spread pins across the whole venue. Collect all section candidates first, then declutter the full set, then push results to `pins`.

---

## Step 4: Rows mode — one pin per section, not one per row

In the `basePins` memo, change the rows mode branch from `getLowestPricePinsByRow` (one per row) to `getLowestPricePin` (one per section — the same pin shown in sections mode):

```ts
} else if (displayMode === 'rows') {
  const cheapest = getLowestPricePin(sectionPins);
  if (!cheapest) continue;
  const lngLat = sectionData.rows[cheapest.listing.rowId]?.center ?? sectionData.center;
  candidates.push({ listing: cheapest.listing, lngLat });
}
```

The pin is now positioned at the listing's row center (more precise than the section center in sections mode), so the user can see exactly which row the deal is in — but it's the same pin, same price, same deal score badge they recognized. Other rows' prices are still accessible via hover (the on-the-fly hover pin already handles this).

---

## Step 5: Update the default density

In `config/defaults.ts`, reduce `pinDensity.sections` from `0.30` to `0.15`. This gives a reasonable starting point; the Prototype Controls slider lets you tune it live.

---

## Validation

1. On initial load, sections mode shows noticeably fewer pins — roughly 10–20, well distributed across the venue rather than one per section.
2. The pins that do appear are the best deals (highest deal score / lowest price), seeded by `declutterPins`' sort order.
3. Zoom into any section — the same pin that was visible in sections mode is still visible in rows mode, now positioned at its row center. No new pins appear for other rows.
4. Hovering a row without a pin shows the on-the-fly hover pin for that row's cheapest listing (existing behavior, unchanged).
5. In Prototype Controls → Interaction → Pin → Sections slider, dragging higher shows more pins in sections mode, lower shows fewer. Changes are reflected immediately.
6. Mobile still gets roughly half the pins (the existing `isMobile` slice at the end of `basePins`).
