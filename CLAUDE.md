# Seating Map Prototype

Interactive venue seating map prototype using React + TypeScript. Explores selection logic, zoom-driven display modes, and interaction patterns on a concert venue map rendered entirely in SVG.

See `PROJECT.md` for design decisions, behavioral specs, and roadmap.

## Commands

```bash
npm i            # Install dependencies
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # Production build to dist/
```

No test runner or linter is configured. This is a prototype — validate changes visually in the browser.

## Tech Stack

- **React 18.3** with TypeScript (no tsconfig — Vite defaults)
- **Vite 6.3** for dev server and bundling
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **react-zoom-pan-pinch 3.7** for map zoom/pan
- **lucide-react** for icons
- ESM modules (`"type": "module"` in package.json)

## File Structure

```
src/
├── main.tsx                              # App entry point
├── styles/                               # CSS: fonts, theme, tailwind
└── app/
    ├── App.tsx                           # Root - renders SeatMapRoot
    ├── components/                       # Shared UI components
    │   ├── Venue.tsx                     # Venue map canvas
    │   ├── Stage.tsx                     # Stage element
    │   ├── VenueBoundary.tsx             # Venue boundary SVG
    │   ├── Section.tsx                   # Orchestrates display mode per section
    │   ├── SectionView.tsx               # sections mode renderer
    │   ├── RowsView.tsx                  # rows mode renderer
    │   ├── SeatsView.tsx                 # seats mode renderer
    │   ├── ListingsPanel.tsx             # Scrollable listing cards sidebar
    │   ├── ListingCard.tsx               # Individual listing card
    │   ├── Pin.tsx                       # Price pin overlay
    │   ├── useHoverIntent.ts             # Hover delay hook (100ms)
    │   ├── types.ts                      # All TypeScript interfaces
    │   ├── constants.ts                  # Dimensions, thresholds, helpers
    │   └── utils.ts                      # hashString, parseSeatId
    └── seatMap/                          # Seat map feature
        ├── config/
        │   ├── types.ts                  # SeatMapConfig interface
        │   └── defaults.ts               # DEFAULT_SEAT_MAP_CONFIG
        ├── model/
        │   └── types.ts                  # Core domain types (SeatMapModel, etc.)
        ├── domain/
        │   └── utils.ts                  # Business logic utilities
        ├── mock/
        │   ├── generateSectionData.ts    # Config → SectionData
        │   ├── generateListings.ts       # SectionData → Listing[]
        │   ├── generatePins.ts           # Listings → PinData
        │   ├── seededRandom.ts           # Mulberry32 PRNG
        │   └── createMockSeatMapModel.ts # Orchestrates generation
        ├── state/
        │   ├── useSeatMapConfig.ts       # Config state management
        │   ├── useSeatMapController.ts   # Derived values (displayMode, etc.)
        │   └── useSeatMapPrototypeViewState.ts  # Selection, hover, navigation
        └── components/
            ├── SeatMapRoot.tsx           # Main orchestration (was App.tsx)
            ├── PrototypeControls.tsx     # Collapsible dev controls
            └── MapContainer.tsx          # react-zoom-pan-pinch wrapper
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
- useState/useMemo/useCallback in App.tsx — no Context, Redux, or Zustand
- Props drilling to child components
- `useMemo` for expensive computations (data generation, grouping, filtering)
- Custom `useHoverIntent` hook for delayed hover callbacks

### Rendering
- All map visuals are **SVG elements** (rect, circle, line, text) — no Canvas or DOM-based rendering
- Use **even-number dimensions** (`SEAT_SIZE = 4`, `SEAT_GAP = 2`) to keep coordinates on whole pixels — see PROJECT.md "Dimension System" for rationale
- All three display modes render SVGs with identical outer dimensions to prevent visual jumping on mode switch

## Gotchas

### ID Format
IDs are hierarchical strings built by concatenation — no delimiters between section and row:
- sectionId: `"B"` (single uppercase letter in current demo)
- rowId: `"B3"` (sectionId + 1-based row number)
- seatId: `"B3-5"` (rowId + `-` + 1-based seat number)
- listingId: `"listing-B-1"` (grouped) or `"solo-B-B3-5"` (solo seat)

This format assumes single-character section IDs. Numeric IDs (e.g., "101") would need a delimiter.

### Seeded Randomization
All data generation is deterministic via Mulberry32 PRNG. Each phase creates its own RNG with a derived seed — RNG instances are **not shared** across sections. Changing the map seed regenerates everything. See the generation files for seed derivation patterns.

### Pin Placement
Uses **Chebyshev distance** (not Euclidean): `max(|Δrow|, |Δseat|) >= 2`. This creates a 3×3 exclusion zone around each placed pin. Up to 3 pins per section via greedy selection.

### Mobile Differences
- Zoom threshold: 3 (vs 5 on desktop)
- Initial scale: 0.5 (vs 1.5 on desktop)
- Renders `ceil(pins.length / 2)` pins (fewer to reduce clutter)
- Layout: map on top (390×200px), listings panel below

### Demo Map
8 sections in 2 rows around a stage. Sections 101 and 104 are sold out (`unavailableRatio: 1.0`) — use them to test unavailable state handling.
