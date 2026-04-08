# Seating Map Prototype Notes

Repo-specific contributor notes for the current MapLibre-based prototype.

## Commands

```bash
npm install
npm run dev
npm run build
npm run test
```

There is no dedicated lint script in `package.json`. Visual verification is still important for map changes.

## Current Stack

- React 18
- TypeScript with `tsconfig.json`
- Vite 6
- Tailwind CSS 4
- MapLibre GL JS 5
- Vitest

## Architecture Notes

- The main map implementation lives in [src/app/components/MapLibreVenue.tsx](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/components/MapLibreVenue.tsx).
- Map rendering is MapLibre layer-driven, not SVG DOM-driven.
- Pins are MapLibre `Marker` overlays with React content.
- Section unavailable state still uses `feature-state`.
- Row and seat unavailable state is property-driven in the decorated detail GeoJSON.

For availability-specific constraints, see [DETAIL_AVAILABILITY.md](./DETAIL_AVAILABILITY.md).

## File Map

```text
src/app/components/MapLibreVenue.tsx
src/app/seatMap/components/SeatMapRoot.tsx
src/app/seatMap/maplibre/
src/app/seatMap/state/
src/app/seatMap/mock/
```

Important MapLibre files:

- `createStyle.ts`
- `paintExpressions.ts`
- `useMapInteractions.ts`
- `useMapSelectionSync.ts`
- `useFeatureState.ts`
- `loadDecoratedDetailGeoJson.ts`

## Accuracy Notes

- Do not document row/seat unavailable state as `feature-state` driven.
- Do not document row muting as `parentMuted` feature-state driven.
- The current hover-intent hook is effectively immediate (`0ms`), not a 100ms or 200ms delay.

## Adding A Venue

When adding a venue manifest, keep only the fields required by the prototype and remove internal or sensitive artifact references before committing.

Then add the new venue entry in:

- [src/app/seatMap/mock/mapRegistry.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/mock/mapRegistry.ts)

## Documentation

- [README.md](./README.md): top-level project overview
- [PROJECT.md](./PROJECT.md): current product and architecture summary
- [INTERACTION.md](./INTERACTION.md): current interaction and visual-state behavior
- [DETAIL_AVAILABILITY.md](./DETAIL_AVAILABILITY.md): row/seat availability workflow
