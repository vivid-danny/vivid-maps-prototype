# Zone Theme: Darken-on-Select with Outline

## Context

The zone color theme assigns a unique color to each section (hot pink, teal, steel blue, etc.) via `getZoneColor()` in `themes.ts`. Colors persist through all zoom levels. This makes a fixed selected-state color unreliable — for example, the current `selectedOverlay` (`rgba(4, 9, 44, 0.4)`) was chosen for the branded theme and may not read clearly against every zone color.

Selection highlighting is implemented via dedicated MapLibre overlay layers — `LAYER_SECTION_SELECTED_OVERLAY` and `LAYER_ROW_SELECTED_OVERLAY` — that sit on top of the base fill. In sections mode, a `match` expression applies `selectedOverlay` to the selected section and `mutedOverlay` (`rgba(255, 255, 255, 0.5)`) to all others. In rows mode, feature-state drives the same two values. Both are passed into `MapLibreVenue` as props from `SeatMapRoot`.

## Goal

For the zone (and deal) themes, replace the fixed `selectedOverlay` color with a relative darkening effect — `rgba(0, 0, 0, 0.25)` by default (black at 25% opacity). This composites on top of whatever zone color the section already has, so the selected element always gets darker than its resting state without introducing an unrelated color. Additionally, add a solid black outline around the selected element at all zoom levels.

Both values should be configurable in Prototype Controls.

---

## New Config Fields

Add to `SeatMapConfig` in `config/types.ts`:

```ts
zoneSelectedOverlay: string;   // overlay applied to selected element in zone/deal themes
selectedOutlineColor: string;  // stroke color on the selected element outline
```

Add defaults in `config/defaults.ts`:

```ts
zoneSelectedOverlay: 'rgba(0, 0, 0, 0.25)',
selectedOutlineColor: 'rgba(0, 0, 0, 0.8)',
```

---

## New Layer Constants

Add to `maplibre/constants.ts`:

```ts
export const LAYER_ROW_SELECTED_OUTLINE = 'row-selected-outline';
export const LAYER_SEAT_SELECTED_OVERLAY = 'seat-selected-overlay';
```

---

## Layer Stack Changes in `maplibre/createStyle.ts`

Accept `selectedOutlineColor` in `StyleOptions`.

**1. Section selected outline** — change `line-color` from `sectionStroke` to `selectedOutlineColor`. No other changes to this layer.

**2. New `row-selected-outline` layer** — insert directly above `LAYER_ROW_SELECTED_OVERLAY`. It's a `line` layer on `SOURCE_ROWS`, hidden by default. Uses a feature-state `case` expression so only the selected row gets the stroke:

```js
paint: {
  'line-color': [
    'case',
    ['boolean', ['feature-state', 'selected'], false], selectedOutlineColor,
    'rgba(0,0,0,0)',
  ],
  'line-width': 1.5,
},
```

**3. New `seat-selected-overlay` layer** — insert directly above `LAYER_SEAT`. It's a `circle` layer on `SOURCE_SEATS`, hidden by default. Uses the same radius interpolation as `LAYER_SEAT`. Uses feature-state so only selected seats are affected:

```js
paint: {
  'circle-color': [
    'case',
    ['boolean', ['feature-state', 'selected'], false], selectedOverlay, // overridden imperatively
    'rgba(0,0,0,0)',
  ],
  'circle-radius': [same interpolation as LAYER_SEAT],
  'circle-stroke-color': [
    'case',
    ['boolean', ['feature-state', 'selected'], false], selectedOutlineColor,
    'rgba(0,0,0,0)',
  ],
  'circle-stroke-width': [
    'interpolate', ['exponential', 2], ['zoom'],
    14, 0.3,
    20, 16,
  ],
},
```

---

## Changes to `MapLibreVenue.tsx`

**Props**: Accept two new props — `zoneSelectedOverlay: string` and `selectedOutlineColor: string`. Pass `selectedOutlineColor` into `createVenueStyle`.

**Derived overlay**: Compute `effectiveSelectedOverlay` at the top of the component body (before any effects):

```ts
const effectiveSelectedOverlay =
  (theme === 'zone' || theme === 'deal') ? zoneSelectedOverlay : selectedOverlay;
```

Use `effectiveSelectedOverlay` everywhere `selectedOverlay` is currently used in `setPaintProperty` calls (section overlay match expression, row overlay case expression, and new seat overlay case expression).

**displayMode effect** — Add visibility toggles for the two new layers alongside their counterparts:

```ts
// Seat overlay: same toggle as seats
setLayerVisibility(map, LAYER_SEAT_SELECTED_OVERLAY, isSeats ? 'visible' : 'none');

// Row outline: same toggle as rows
setLayerVisibility(map, LAYER_ROW_SELECTED_OUTLINE, (isRows || isSeats) ? 'visible' : 'none');
```

**Section selection effect** — `LAYER_SECTION_SELECTED_OUTLINE` is currently shown only when `displayMode !== 'sections'`. Remove that condition — show it whenever there's a section selected, at any zoom level. Update the filter and visibility the same way for all display modes.

**Style update effect** (the one that calls `setPaintProperty` for outlines, labels, etc.) — Add updates for the two new layers:

```ts
map.setPaintProperty(LAYER_SECTION_SELECTED_OUTLINE, 'line-color', selectedOutlineColor);

map.setPaintProperty(LAYER_ROW_SELECTED_OUTLINE, 'line-color', [
  'case',
  ['boolean', ['feature-state', 'selected'], false], selectedOutlineColor,
  'rgba(0,0,0,0)',
]);

map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-color', [
  'case',
  ['boolean', ['feature-state', 'selected'], false], effectiveSelectedOverlay,
  'rgba(0,0,0,0)',
]);
map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-stroke-color', [
  'case',
  ['boolean', ['feature-state', 'selected'], false], selectedOutlineColor,
  'rgba(0,0,0,0)',
]);
```

Add `zoneSelectedOverlay`, `selectedOutlineColor`, and `effectiveSelectedOverlay` to the dependency arrays of any effect that references them.

---

## Changes to `SeatMapRoot.tsx`

Pass the two new props to `<MapLibreVenue>`:

```tsx
zoneSelectedOverlay={config.zoneSelectedOverlay}
selectedOutlineColor={config.selectedOutlineColor}
```

---

## Changes to `PrototypeControls.tsx`

In the Styles tab, under the **DEFAULT_COLORS** section (alongside Muted Overlay and Selected Overlay), add:

```tsx
<ColorControl
  label="Zone Selected Overlay"
  value={config.zoneSelectedOverlay}
  onChange={(value) => onConfigChange({ zoneSelectedOverlay: value })}
/>
<ColorControl
  label="Selected Outline"
  value={config.selectedOutlineColor}
  onChange={(value) => onConfigChange({ selectedOutlineColor: value })}
/>
```

---

## Validation Checklist

1. **Sections mode, zone theme** — select a section: it should appear darker (black overlay composited on zone color), with a visible black outline. Unselected sections stay muted (white 50% overlay). Deselect: all sections return to full zone colors, outline disappears.
2. **Rows mode, zone theme** — select a row: the selected row gets the darken overlay and an outline. Sibling rows in the same section are muted. Rows in other sections stay at their zone color.
3. **Seats mode, zone theme** — select seats: each selected seat gets the darken overlay and an outline ring.
4. **Branded theme** — repeat steps 1–3 and confirm the original `selectedOverlay` value (`rgba(4, 9, 44, 0.4)`) is used instead of `zoneSelectedOverlay`.
5. **Controls** — in Prototype Controls → Styles, verify "Zone Selected Overlay" and "Selected Outline" color pickers appear. Adjust both and confirm live map updates at each zoom level.
6. **Reset All** — confirm both new fields reset to their defaults.

---

## Notes

- `LAYER_SECTION_SELECTED_OUTLINE` already exists with the right structure — the main changes are swapping its color source and removing the sections-mode visibility exclusion.
- All selection feature-state infrastructure (row/seat `selected` flag in `useMapSelectionSync`) is already in place and requires no changes.
- The seat overlay layer is only visible in seats mode anyway (same toggle as `LAYER_SEAT`), so no special guard is needed around seat selection state.
