# Listing Selection: Seat Grouping and Connector

## Context

A listing is a contiguous range of seats within a single row (e.g. Row 3, seats A–D). Clicking any seat in a listing should select the entire listing. Selected seats are visually linked by a connector — a line running through all selected seat centers, same width as the seat circles, so the group reads as a single unit. Section and row selections auto-resolve to a listing if that section/row contains exactly one — otherwise they act as filters (panel narrows, camera navigates, no seat-level selection).

Listings never span rows. All seats in a listing are always contiguous (A, B, C, D — never A, B, D). Single-seat listings behave identically — they just have no connector since there's nothing to connect. Unavailable seats are not selectable.

---

## Fix 1: Seat click → expand to full listing

In `useSeatMapPrototypeViewState.ts`, `handleSelect` already resolves a `listingId` from a single clicked seat but doesn't expand `seatIds` to the full listing. In the block that finds a match:

```ts
if (match) {
  nextSelection = {
    ...nextSelection,
    listingId: match.listingId,
    rowId: match.rowId,
    seatIds: match.seatIds,  // ← expand to all seats in the listing
  };
}
```

Without this, only the clicked seat gets `selected: true` in feature-state, so the overlay and connector only affect one circle.

---

## Fix 2: Section/row click → auto-resolve to listing when unambiguous

Still in `handleSelect`, after the `getToggledSelection` call and before `setSelection`, add two resolution blocks:

**Section-only click** — if `nextSelection` has a `sectionId` but no `rowId`, no `seatIds`, and no `listingId`:

```ts
const sectionListings = listingsBySection.get(nextSelection.sectionId) ?? [];
if (sectionListings.length === 1) {
  const l = sectionListings[0];
  nextSelection = { sectionId: l.sectionId, rowId: l.rowId, listingId: l.listingId, seatIds: l.seatIds };
}
```

If there are 0 or 2+ listings, leave `nextSelection` as a section selection (filter mode — existing behavior).

**Row-only click** — if `nextSelection` has a `sectionId` and `rowId` but no `seatIds` and no `listingId`:

```ts
const rowListings = (listingsBySection.get(nextSelection.sectionId) ?? [])
  .filter(l => l.rowId === nextSelection.rowId);
if (rowListings.length === 1) {
  const l = rowListings[0];
  nextSelection = { sectionId: l.sectionId, rowId: l.rowId, listingId: l.listingId, seatIds: l.seatIds };
}
```

Same fallback: 0 or 2+ listings → row selection (filter mode).

No changes needed to `useMapInteractions.ts` — it stays dumb and fires the raw geometric selection; all listing resolution lives in the state layer.

---

## Connector: Visual line linking selected seats

**New constants** in `maplibre/constants.ts`:

```ts
export const SOURCE_SEAT_CONNECTOR = 'seat-connector-source';
export const LAYER_SEAT_CONNECTOR = 'seat-connector';
```

**New source and layer** in `createStyle.ts`:

Add `SOURCE_SEAT_CONNECTOR` as a GeoJSON source with an empty FeatureCollection as initial data. Add `LAYER_SEAT_CONNECTOR` as a `line` layer on that source, inserted directly above `LAYER_SEAT_SELECTED_OVERLAY`, hidden by default:

```js
{
  id: LAYER_SEAT_CONNECTOR,
  type: 'line',
  source: SOURCE_SEAT_CONNECTOR,
  layout: {
    visibility: 'none',
    'line-cap': 'round',
    'line-join': 'round',
  },
  paint: {
    'line-color': seatColors.connectorSelected,
    'line-width': [
      'interpolate', ['exponential', 2], ['zoom'],
      14, 4,
      20, 256,
    ],
  },
},
```

The `line-width` doubles the circle-radius interpolation so the connector fills the visual gap between seat circles, making the group read as a solid block.

**Updating the connector** in `MapLibreVenue.tsx`:

Add an effect on `selection.seatIds`. When `seatIds.length >= 2`:

1. Wait ~600ms after the selection (after the `easeTo` 500ms animation finishes) before querying — the features need to be in the viewport.
2. Query seat positions: `map.querySourceFeatures(SOURCE_SEATS, { filter: ['in', ['get', 'id'], ['literal', selection.seatIds]] })`
3. Sort returned features by their seat index. Parse the seat number from the `id` property (the part after the last `:` in the GeoJSON feature id format — check the actual format against the model's `seatId` format to confirm they match).
4. Extract `geometry.coordinates` from each sorted Point feature.
5. Build a LineString and call:
   ```ts
   (map.getSource(SOURCE_SEAT_CONNECTOR) as GeoJSONSource).setData({
     type: 'FeatureCollection',
     features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} }],
   });
   ```
6. Make the connector layer visible: `setLayerVisibility(map, LAYER_SEAT_CONNECTOR, 'visible')`.

When `seatIds.length < 2` (single-seat listing or no selection): clear the source data to an empty FeatureCollection and set layer visibility to `'none'`.

**Visibility toggling in the displayMode effect**: Add `LAYER_SEAT_CONNECTOR` alongside `LAYER_SEAT` and `LAYER_SEAT_SELECTED_OVERLAY` — all three use `isSeats ? 'visible' : 'none'`. The connector effect above handles the finer-grained control within seats mode.

**Color updates** in the style update effect:

```ts
map.setPaintProperty(LAYER_SEAT_CONNECTOR, 'line-color', seatColors.connectorSelected);
```

`seatColors` is already in the dep array, so this is covered.

---

## No model changes needed

`seatToListing` doesn't need to be added to the model type — `handleSelect` already uses `listings.find(...)` which is fast enough at this scale, and the real bottleneck is the GeoJSON query, not the JS lookup.

---

## Validation Checklist

1. Click one seat in a multi-seat listing → all seats in the listing show the darken overlay and outline. The connector line runs through all of them.
2. Click a single-seat listing → seat shows darken overlay and outline. No connector (single point, nothing to connect).
3. Click an unavailable seat → nothing happens.
4. Click a section with exactly 1 listing → jumps directly to the listing selection (detail panel opens, all seats highlighted, connector visible).
5. Click a section with multiple listings → section filter mode only (panel narrows to that section, no seats highlighted).
6. Same as 4 and 5 but for rows.
7. Select from listing panel → all seats highlighted with connector (already works via `handleSelectFromPanel` since it passes the full `seatIds`; verify it still does after changes).
8. Deselect → connector disappears, all seats return to base color.
