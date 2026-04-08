# Vivid Maps Prototype

Interactive seating map prototype built with React, TypeScript, and MapLibre GL JS.

The current prototype renders venue geometry from GeoJSON sources, supports section/row/seat display modes, keeps map and panel selection in sync, and overlays listing pins and seat connectors on top of the map.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build
npm run test
```

## Current Architecture

- Rendering: `maplibre-gl` with GeoJSON sources and MapLibre style layers
- Venue assets: section, row, and seat GeoJSON plus optional raster background / venue chrome assets
- Display modes: `sections`, `rows`, `seats`
- Selection: unified `SelectionState` shared between map and listings panel
- Pins: MapLibre `Marker` overlays rendered with React

Rows and seats use property-driven availability in the loaded detail source data. Sections still use MapLibre `feature-state` for unavailable state.

## Tech Stack

- React 18
- TypeScript
- Vite 6
- Tailwind CSS 4
- MapLibre GL JS 5
- Vitest

## Key Paths

```text
src/app/components/MapLibreVenue.tsx
src/app/seatMap/maplibre/
src/app/seatMap/components/SeatMapRoot.tsx
src/app/seatMap/state/useSeatMapPrototypeViewState.ts
```

## Documentation

- [PROJECT.md](./PROJECT.md): current product and architecture overview
- [INTERACTION.md](./INTERACTION.md): current interaction and visual-state behavior
- [DETAIL_AVAILABILITY.md](./DETAIL_AVAILABILITY.md): row/seat availability workflow
- [CLAUDE.md](./CLAUDE.md): contributor notes and repo-specific guidance
