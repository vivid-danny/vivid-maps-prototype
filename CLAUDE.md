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
- [PRODUCT.md](./PRODUCT.md): brand personality, users, emotional goals, anti-references
- [DESIGN.md](./DESIGN.md): colors, typography, spacing, component patterns

## Design Context

### Users
Ticket buyers on VividSeats — desktop and mobile. Browsing or making a final purchase decision for a live event. They know what event they want; the map helps them decide where to sit. Emotional state: anticipation. The interface should match that gravity.

### Brand Personality
Sharp, premium, decisive. Clean geometry, considered spacing, unambiguous interactive states. GT Walsheim as the voice of the brand.

### Aesthetic Direction
Light mode throughout. The Vivid pink (`#CE3197`/`#D63384`) is the single accent — restrained to map fills and CTAs. All panel chrome is white/gray and recedes. The map is the hero; UI panels serve it.

Anti-references: StubHub's flat utility gray, Ticketmaster's heavy dark mode, mobile game neon/gamification.

### Design Principles
1. **The map is the hero.** UI chrome recedes — panels, headers, and cards should never compete with venue geometry for attention.
2. **Color carries meaning, not decoration.** Pink = available/branded, purple = selected, navy = neutral context. Don't add color for visual interest; it already has a job.
3. **Decisive hierarchy.** Price, location, action — in that cognitive order. Users should never scan to find what they need.
4. **Motion orients, it doesn't entertain.** Transitions communicate state changes. No bounce, no elastic, no flourish for its own sake.
5. **Premium restraint.** Every element must justify its presence. Tighter is better than fuller. Silence is a design choice.
