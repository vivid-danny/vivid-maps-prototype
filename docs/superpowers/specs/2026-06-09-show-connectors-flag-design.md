# Design: `showConnectors` flag — remove seat connectors

**Date:** 2026-06-09
**Status:** Approved (design)

## Goal

Explore a seat-rendering variation where seats render as individual dots with
no connector lines tying a listing's seats together. Implement this as a
reversible config flag (`showConnectors`) so the two renderings can be compared
live, rather than tearing out the connector machinery.

## Background

"Connectors" are `LineString` features drawn between consecutive seats within a
single listing (listings with 2+ seats). They span:

- A dynamic GeoJSON source (`seat-connectors`, `SOURCE_SEAT_CONNECTORS`)
  populated by the `useListingConnectors` hook.
- Four MapLibre layers: base line, hover overlay, muted overlay, selected
  overlay.
- Hover/click interaction handlers in `useMapInteractions.ts`.
- Selection sync in `useMapSelectionSync.ts`.
- Theme color tokens (`connector`, `connectorHover`, `connectorPressed`,
  `connectorSelected`).

## Decision: mechanism

The flag hides connectors via **data-gating** (chosen over visibility-gating or
skipping layer creation):

- `useListingConnectors` receives `showConnectors`. When `false`, it sets the
  source to an empty `FeatureCollection`.
- All four connector layers stay registered but have nothing to draw — no
  lines, no hover targets, no selected/muted overlays.
- No changes to the visibility effects, interaction handlers, or `createStyle`.
- Fully live-toggleable; flipping the flag back on re-populates the source.

Rejected alternatives:

- **Visibility-gating** — would require a new `CONNECTOR_LAYERS` constant and
  gated `setLayoutProperty` calls in two effects (the displayMode effect and
  the muted-overlay effect), plus dependency-array wiring. Same visual result,
  more touch points.
- **Skip layer creation in `createStyle`** — most invasive; requires guarding
  interaction handlers against missing layers and a full style rebuild to
  toggle.

## Changes

1. **`config/types.ts`** — add `showConnectors: boolean` to `SeatMapConfig`.
2. **`config/defaults.ts`** — default `showConnectors: true` (connectors on; a
   user must opt out). The existing merge in `SeatMapRoot`
   (`{...createDefaultSeatMapConfig(), ...stored}`) absorbs the new field for
   persisted configs.
3. **`useListingConnectors.ts`** — accept `showConnectors`; extract the
   feature-building into a pure helper `buildConnectorFeatures(listings,
   coordsBySeatId)` and, in the effect, set empty data when `showConnectors`
   is false. Add `showConnectors` to the effect dependency list.
4. **`MapLibreVenue.tsx`** — add `showConnectors: boolean` prop; pass it into
   the `useListingConnectors({ ..., showConnectors })` call.
5. **`SeatMapRoot.tsx`** — pass `config.showConnectors` to `MapLibreVenue`.
6. **`PrototypeControls.tsx`** — add a "Show seat connectors" checkbox wired to
   `updateConfig({ showConnectors })`.
7. **`state/useUrlParams.ts`** — add `showConnectors` to the URL-param system
   (parsed as `true`/`false`, omitted from the URL when it equals the default),
   matching the existing `theme`/display-mode params. Wired in `SeatMapRoot`
   via `INITIAL_URL_PARAMS` (startup) and the `syncToUrl` effect. Shareable as
   `?showConnectors=false`. Note: `localStorage` still takes precedence over the
   URL param for returning visitors — existing behavior for all params.

## Testing

- Unit test the extracted pure helper `buildConnectorFeatures` (Vitest, matching
  the `deriveVisualSeatAssignments.test.ts` pattern):
  - builds a `LineString` per listing with 2+ resolvable seat coordinates;
  - skips listings with fewer than 2 seats;
  - skips listings whose seats have no coordinates.
- The `showConnectors` gate lives in the effect (sets empty data when off); it
  is verified by visual check rather than mocking the MapLibre source.
- Visual verification in `npm run dev`: connectors absent by default, toggle in
  the controls panel shows/hides them live.

## Out of scope

- Removing connector theme tokens, layers, or interaction handlers.
- Any change to how individual seat dots render.
