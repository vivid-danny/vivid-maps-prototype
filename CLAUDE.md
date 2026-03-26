# Seating Map Prototype

Interactive venue seating map prototype using React + TypeScript. Explores selection logic, zoom-driven display modes, and interaction patterns on a concert venue map rendered with MapLibre GL JS.

See `PROJECT.md` for design decisions, behavioral specs, and roadmap.

## Commands

```bash
npm i            # Install dependencies
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # Production build to dist/
```

No test runner or linter is configured. This is a prototype — validate changes visually in the browser.

## Adding a New Map

When adding a venue, the pipeline generates a `manifest.json`. **Before committing it**, strip all sensitive fields — only keep `bounds`, `center`, `images` (coordinates only, no `filename`), and `sections`. Remove `tileSource`, `glyphSource`, `imageSource`, `stageStyle`, and any internal artifact paths.

Safe manifest shape:
```json
{
  "bounds": [...],
  "center": { "lng": ..., "lat": ... },
  "images": [{ "id": "background", "coordinates": [[...], [...], [...], [...]] }],
  "sections": { "101": { ... }, ... }
}
```

Then add an entry to `src/app/seatMap/mock/mapRegistry.ts` pointing `assets` at the venue's files in `public/`.

## Tech Stack

- **React 18.3** with TypeScript (no tsconfig — Vite defaults)
- **Vite 6.3** for dev server and bundling (`esbuild: { target: 'esnext' }` required for MapLibre workers)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **MapLibre GL JS 5.x** for map rendering (GeoJSON layers, raster background, feature state)
- **lucide-react** for icons
- ESM modules (`"type": "module"` in package.json)

## File Structure

```
src/
├── main.tsx                              # App entry point (imports maplibre-gl CSS)
├── styles/                               # CSS: fonts, theme, tailwind
└── app/
    ├── App.tsx                           # Root - renders SeatMapRoot
    ├── components/                       # Shared UI components
    │   ├── MapLibreVenue.tsx             # Main map component: wires all MapLibre hooks
    │   ├── ListingsPanel.tsx             # Scrollable listing cards sidebar
    │   ├── ListingCard.tsx               # Individual listing card
    │   ├── Pin.tsx                       # Price pin overlay (MapLibre Marker + React root)
    │   ├── useHoverIntent.ts             # Hover delay hook (100ms)
    │   ├── constants.ts                  # Dimensions, thresholds, helpers
    │   └── ticketDetail/                 # Ticket detail overlay components
    │       ├── TicketDetail.tsx
    │       ├── TicketDetailHeader.tsx
    │       ├── TicketDetailCheckout.tsx
    │       ├── TicketDetailDelivery.tsx
    │       ├── TicketDetailEventInfo.tsx
    │       ├── TicketDetailInfo.tsx
    │       └── TicketDetailPerks.tsx
    └── seatMap/                          # Seat map feature
        ├── config/
        │   ├── types.ts                  # SeatMapConfig interface
        │   ├── themes.ts                 # Color themes, ThemeId, DEAL_SCORE_COLORS, getDealColor
        │   └── defaults.ts               # DEFAULT_SEAT_MAP_CONFIG
        ├── model/
        │   └── types.ts                  # Core domain types (SeatMapModel, etc.)
        ├── behavior/
        │   ├── rules.ts                  # Selection/hover/visual state rules
        │   ├── visualState.ts            # InteractionState, resolveInteractionState, resolveSectionFill
        │   ├── pins.ts                   # Pin visibility/overlay rules
        │   └── utils.ts                  # Shared behavior utilities
        ├── maplibre/                     # MapLibre GL integration
        │   ├── useMapLibre.ts            # Map init, zoom state tracking, exposes __map in dev
        │   ├── useMapInteractions.ts     # Click/hover event handlers on map layers
        │   ├── useMapSelectionSync.ts    # React selection/hover → setFeatureState
        │   ├── useFeatureState.ts        # Inventory (available/unavailable) → feature state
        │   ├── useVenueManifest.ts       # Fetches manifest.json, returns seatableIds + sectionCenters
        │   ├── useMapPins.ts             # Pin overlays: Marker + React root per pin
        │   ├── createStyle.ts            # MapLibre StyleSpecification (sources + layers)
        │   ├── paintExpressions.ts       # Fill color expressions (zone/deal themes)
        │   ├── constants.ts              # Layer IDs, source IDs, zoom thresholds, colors
        │   └── types.ts                  # VenueAssets interface
        ├── mock/
        │   ├── createManifestSeatMapModel.ts # manifest + venueSeatCounts → SeatMapModel
        │   ├── mapRegistry.ts            # MapDefinition with VenueAssets per venue
        │   ├── venueSeatCounts.json      # Section/row seat counts (from seats.geojson)
        │   ├── theaterVenueData.json     # Theater venue data
        │   └── seededRandom.ts           # Mulberry32 PRNG
        ├── state/
        │   ├── useSeatMapConfig.ts       # Config state management
        │   ├── useLayoutMode.ts          # Viewport layout mode detection (mobile vs desktop)
        │   ├── useSeatMapController.ts   # Derived values (displayMode, etc.)
        │   ├── useSeatMapPrototypeViewState.ts  # Selection, hover, navigation
        │   └── useUrlParams.ts           # URL param sync for shareable config
        └── components/
            ├── SeatMapRoot.tsx           # Main orchestration
            └── PrototypeControls.tsx     # Collapsible dev controls
```

## Code Conventions

### Exports & Imports
- Use **named exports** exclusively (no default exports)
- Use `import type { ... }` for type-only imports
- Relative paths for all imports (no `@/` aliases despite vite config)

### Naming
- **Components:** PascalCase files and function names (`Section.tsx` → `export function Section()`)
- **Utilities/hooks:** camelCase files (`utils.ts`, `useHoverIntent.ts`)
- **Props interfaces:** `{ComponentName}Props` (e.g., `SectionProps`, `PinProps`)
- **Handlers:** `handle{Action}` in the defining component, passed as `on{Action}` props
- **State:** `const [value, setValue] = useState(...)` — standard React convention
- **Constants:** `UPPER_SNAKE_CASE` for module-level constants (`SEAT_SIZE`, `ZOOM_THRESHOLD`)

### State Management
- useState/useMemo/useCallback in feature hooks — no Context, Redux, or Zustand
- Props drilling to child components
- `useMemo` for expensive computations (data generation, grouping, filtering)
- Custom `useHoverIntent` hook for delayed hover callbacks

### Rendering
- Map rendering via **MapLibre GL JS** — GeoJSON polygon/circle layers with paint expressions, raster background image
- Display modes (sections/rows/seats) controlled by **layer visibility** toggled imperatively via `map.setLayoutProperty`
- Visual state (selected, hovered, unavailable) driven by **feature state** (`map.setFeatureState`) — paint expressions resolve colors on the GPU
- Pins rendered as **MapLibre Markers** with React roots — not part of the GL layer stack

## Gotchas

### ID Format (GeoJSON)
IDs match GeoJSON feature `id` properties:
- sectionId: `"101"` (numeric string)
- rowId: `"101:1"` (sectionId + `:` + row number)
- seatId: `"101:1:s1"` (sectionId + `:` + row + `:s` + seat index)
- All sources use `promoteId: 'id'` so the `id` property becomes the feature ID for feature state operations.

### Seeded Randomization
All data generation is deterministic via Mulberry32 PRNG. Each phase creates its own RNG with a derived seed — RNG instances are **not shared** across sections. Changing the map seed regenerates everything.

### Zoom Thresholds
Uses synthetic lat/lng coordinates near the origin. `ROW_ZOOM_MIN = 14` controls the sections→seats display mode switch (`fitBounds` zoom at load is ~13.9). `SEAT_ZOOM_MIN = 16` is defined but not currently used for layer visibility.

### Concourse Section Filter
Sections like `997`, `901`, `BANNER LOUNGE Compound` are non-seatable MultiPolygon areas. They're filtered out imperatively via `map.setFilter` once the manifest loads, using the `seatableIds` array from `useVenueManifest`.

### Pin Placement
Uses **Chebyshev distance** (not Euclidean): `max(|Δrow|, |Δseat|) >= 2`. This creates a 3×3 exclusion zone around each placed pin. Up to 3 pins per section via greedy selection.

### Mobile Differences
- Renders `ceil(pins.length / 2)` pins (fewer to reduce clutter)
- Layout: map on top (390×200px), listings panel below
- Hover disabled entirely

### Venue Assets
Each map in `mapRegistry.ts` has `assets: VenueAssets` with `manifestUrl`, `backgroundUrl`, `sectionsUrl`, `rowsUrl`, `seatsUrl`. Changing `assets` recreates the map style. Always strip sensitive fields from manifest before committing (no `tileSource`, `glyphSource`, `imageSource`, `stageStyle`).
