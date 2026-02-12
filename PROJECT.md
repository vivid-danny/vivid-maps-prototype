# Seating Map Prototype

A prototype for exploring selection logic and interaction patterns on a concert venue seating map.

## Project Goal

Build an interactive seating map that allows users to select seats, rows, or sections. The prototype uses simple geometric shapes (SVG circles for seats) to clearly define logic and interaction patterns before applying visual polish.

## Core Concepts

### Hierarchy

```
Venue Map (1)
  └── Sections (many)
        └── Rows (many)
              └── Seats (many)
```

- Only one venue map is visible on the canvas at a time
- A venue contains multiple sections
- A section contains multiple rows
- A row contains multiple seats

### Display Modes

The map supports different display modes that determine what level of detail is shown and selectable:

| Mode | Visual | Selectable Unit |
|------|--------|-----------------|
| `seats` | Individual seat circles with listing connectors | Seats (or grouped listings) |
| `rows` | Horizontal bars representing rows | Rows |
| `sections` | Filled rounded rectangle with label | Sections |

**Zoom-based switching:** Display mode automatically switches based on zoom level:
- Below threshold (default 5x): Shows "Initial Display" mode (configurable, default: sections)
- At or above threshold: Shows "Zoomed Display" mode (configurable, default: seats)

### Selection Architecture

Selection uses a **unified state model** that syncs across all display modes and zoom levels.

**Selection State:**
```typescript
interface SelectionState {
  sectionId: string | null;  // Set whenever anything is selected
  rowId: string | null;      // Set when row or seat is selected
  listingId: string | null;  // Set when a listing/seat is selected
  seatIds: string[];         // The actual seat IDs (for multi-seat listings)
}
```

**Selection propagates UP the hierarchy:**
- Selecting a **seat** → automatically sets `rowId` and `sectionId`
- Selecting a **row** → automatically sets `sectionId`
- Selecting a **section** → only sets `sectionId`

**Selection does NOT propagate down:**
- Selecting a section does NOT select any rows or seats
- Selecting a row does NOT select any seats

**Deselection behavior:**
- Clicking the same item toggles it off (clears entire selection)
- Clicking a different item replaces the selection
- Level-aware toggle: clicking a section that's selected via seat/row still deselects in one click

**Single selection only:** Only one thing can be selected at a time. No multi-select.

**Availability Rules:**
- A row is available if at least one seat in it is available
- A section is available if at least one seat in any row is available
- Unavailable items cannot be selected and show no hover/press states

### Map Configuration

Maps are defined via configuration objects, enabling different venue layouts:

```typescript
interface MapConfig {
  id: string;
  name: string;
  sections: SectionConfig[];
  seed: number;  // For deterministic random generation
}

interface SectionConfig {
  sectionId: string;
  label: string;              // Display label ("101", "Pit", "Orchestra")
  numRows: number;
  seatsPerRow: number;
  x: number;
  y: number;
  unavailableRatio?: number;  // 0.0 to 1.0, default 0.1
  listingCount?: number;      // Number of seat groupings, default 5
  seatsPerListing?: [number, number];  // [min, max] seats per listing
}
```

**Seeded randomization:** Using the map's `seed` value, each section deterministically generates:
- Which seats are unavailable (based on `unavailableRatio`)
- Which seats are grouped into listings (based on `listingCount` and `seatsPerListing`)

Same seed = same layout every time. Different seeds = different configurations.

### Section Labels

In `sections` display mode, each section displays a label centered on the section polygon:
- **Styling:** Bold Helvetica, 8px, 100% line-height
- **Colors:**
  - Default (available): Dark maroon (#5D1A1A)
  - Hovered/pressed/selected: White (#FFFFFF)
  - Unavailable: Light gray (#B0B0B0)

### Navigation

- **Zoom:** In/out to adjust detail level (1x - 50x), triggers display mode switching at threshold
- **Pan:** Move around the map to browse different areas

## Current Implementation

### Components

| Component | File | Description |
|-----------|------|-------------|
| `App` | `src/app/App.tsx` | Main app with unified selection state and prototype controls |
| `PrototypeControls` | `src/app/components/PrototypeControls.tsx` | Collapsible dev controls panel (scales, thresholds, colors) |
| `MapContainer` | `src/app/components/MapContainer.tsx` | Wraps content with zoom/pan, reports scale changes |
| `Venue` | `src/app/components/Venue.tsx` | Container representing the venue map canvas |
| `VenueBoundary` | `src/app/components/VenueBoundary.tsx` | SVG boundary outline for the venue |
| `Stage` | `src/app/components/Stage.tsx` | Stage visual element |
| `Section` | `src/app/components/Section.tsx` | Orchestrates display modes, renders pins, handles selection per section |
| `SectionView` | `src/app/components/SectionView.tsx` | Section rectangle with label (used in `sections` mode) |
| `RowsView` | `src/app/components/RowsView.tsx` | Horizontal bars per row (used in `rows` mode) |
| `SeatsView` | `src/app/components/SeatsView.tsx` | Seat circles with listing connectors (used in `seats` mode) |
| `ListingsPanel` | `src/app/components/ListingsPanel.tsx` | Scrollable listing cards sidebar, filters by selection |
| `ListingCard` | `src/app/components/ListingCard.tsx` | Individual listing card with hover intent delay |
| `Pin` | `src/app/components/Pin.tsx` | Price pin overlay rendered at seat positions |
| `useHoverIntent` | `src/app/components/useHoverIntent.ts` | Custom hook for delayed hover callbacks (100ms) |
| `generateSectionData` | `src/app/components/generateSectionData.ts` | Generates SectionData from config using seeded random |
| `generateListings` | `src/app/components/generateListings.ts` | Extracts and enriches Listing[] from section data |
| `generatePins` | `src/app/components/generatePins.ts` | Selects up to 3 pins per section (Chebyshev distance ≥ 2) |
| `utils` | `src/app/components/utils.ts` | Shared utilities: hashString, parseSeatId |
| `seededRandom` | `src/app/components/seededRandom.ts` | Mulberry32 PRNG for deterministic randomization |
| `constants` | `src/app/components/constants.ts` | Shared dimension constants and helper functions |
| `types` | `src/app/components/types.ts` | Shared TypeScript interfaces |

### Dimension System

All dimensions use **even numbers** to avoid sub-pixel rendering issues. This ensures consistent sizing across all display modes.

```typescript
// constants.ts
SEAT_SIZE = 4   // 4×4px seats (center at 2px - whole pixel)
SEAT_GAP = 2    // 2px horizontal gap between seats
ROW_GAP = 2     // 2px vertical gap between rows
PADDING = 1     // 1px padding to prevent edge clipping
ZOOM_THRESHOLD = 5  // Scale at which display mode switches
```

**Calculated dimensions** (for 11 seats × 9 rows):
- Row width: `seatCount × SEAT_SIZE + (seatCount - 1) × SEAT_GAP + PADDING × 2` = 11×4 + 10×2 + 2 = **66px**
- Section height: `rowCount × SEAT_SIZE + (rowCount - 1) × ROW_GAP + PADDING × 2` = 9×4 + 8×2 + 2 = **54px**

**Why even numbers matter:**
- Odd dimensions (e.g., 3px seats) force sub-pixel coordinates (center at 1.5px)
- Sub-pixel rendering causes visual inconsistencies
- Even dimensions ensure circle centers, stroke positions, and element boundaries land on whole pixels

**Sizing consistency across modes:**
- All three display modes (seats, rows, sections) render SVGs with identical dimensions
- Switching modes doesn't cause visual "jumping" or size changes

### Data Types

```typescript
type DisplayMode = 'seats' | 'rows' | 'sections';

interface SeatColors {
  available: string;
  unavailable: string;
  hover: string;
  pressed: string;
  selected: string;
}

interface SeatData {
  seatId: string;
  status: 'available' | 'unavailable';
  listingId?: string;  // Groups seats that belong to the same listing
}

interface RowData {
  rowId: string;
  seats: SeatData[];
}

interface SectionData {
  sectionId: string;
  rows: RowData[];
}

interface SelectionState {
  sectionId: string | null;
  rowId: string | null;
  listingId: string | null;
  seatIds: string[];
}

interface SectionConfig {
  sectionId: string;
  label: string;
  numRows: number;
  seatsPerRow: number;
  x: number;
  y: number;
  unavailableRatio?: number;
  listingCount?: number;
  seatsPerListing?: [number, number];
}

interface MapConfig {
  id: string;
  name: string;
  sections: SectionConfig[];
  seed: number;
}
```

### ID Format

Current ID format (single-letter section IDs):
- **sectionId:** `"A"`, `"B"`, etc.
- **rowId:** `"{sectionId}{rowNum}"` → `"A1"`, `"A2"`, etc.
- **seatId:** `"{rowId}-{seatNum}"` → `"A1-5"`, `"A3-7"`, etc.

*Note: This format assumes single-letter sections. For numeric section IDs (e.g., "101"), a delimiter would be needed to avoid ambiguity.*

### Seat States

All colors are configurable via the Prototype Controls panel.

| State | Default Color | Description |
|-------|---------------|-------------|
| Available | `#CE3197` | Available seat, no interaction |
| Unavailable | `#FAEAF5` | Seat cannot be selected, no hover/press states |
| Hover | `#7A1D59` | Mouse over seat |
| Pressed | `#3E0649` | Mouse down on seat |
| Selected | `#312784` | Seat has been clicked/selected |

### Seat Groupings (Listings)

Seats can be grouped together via a shared `listingId`. This represents tickets being sold together (e.g., someone reselling 4 adjacent seats as a group).

**Behavior:**
- Grouped seats are visually connected with a thin SVG line between them
- Hovering one seat in a group highlights all seats + connector
- Clicking one seat selects all seats in the group
- Connector color matches seat state (hover, pressed, selected)
- Groups only contain available seats and are always adjacent in the same row

### Prototype Controls

A control panel on the left side allows real-time configuration of:
- **Zoom Status:** Current zoom level, active display mode, threshold
- **Initial Display:** Display mode when zoomed out (sections/rows/seats)
- **Zoomed Display:** Display mode when zoomed in (sections/rows/seats)
- **Seat Colors:** Available, unavailable, hover, pressed, selected

### Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- `react-zoom-pan-pinch` for map navigation

## What's Next

- [x] Row display mode (rows rendered as horizontal bars)
- [x] Row selection (single row selection in `rows` mode)
- [x] Section display mode (`sections` mode showing section as rounded rectangle)
- [x] Section selection (managed at App level for multi-section support)
- [x] Consistent sizing across display modes (even-number dimension system)
- [x] Zoom-level based display mode switching
- [x] Unified selection state that syncs across zoom levels
- [x] Config-based section generation with seeded randomization
- [x] Section labels
- [ ] Add more sections to the venue (multi-section map)
- [ ] Click-to-zoom behavior (clicking section zooms to row/seat detail)
- [ ] Visual indication in rows/seats mode when section is selected but no row/seat is
- [ ] Explore multi-select patterns

## Open Questions

1. ~~How should zoom level affect selection targets?~~ → Zoom level switches display modes; selection syncs across modes
2. ~~How should "select all children" work when selecting a section/row?~~ → Selection does NOT propagate down; selecting a section/row doesn't auto-select children
3. ~~Should there be a visual distinction between individual seats and grouped listings at zoomed-out views?~~ → In `rows`/`sections` mode, listings don't apply; the row/section is the atomic unit
4. Should clicking a section/row zoom into it, or just select it?
5. ~~How should selection state persist when switching display modes?~~ → Unified SelectionState syncs across all modes
6. What should happen visually when you zoom in after selecting a section? (Currently: section is selected but no rows/seats are highlighted)

## Refactoring History

### February 11, 2026 - Domain-Driven Architecture

Restructured codebase from flat organization to domain-driven architecture with feature-based organization:

**Before:**
- All logic in 455-line `App.tsx`
- Generators, components, types flat in `components/` folder

**After:**
- App.tsx reduced to 5 lines (renders `SeatMapRoot`)
- Created `seatMap/` feature folder with clear separation:
  - `config/` - Configuration schema and defaults
  - `model/` - Core domain types
  - `domain/` - Business logic utilities
  - `mock/` - Data generation (clearly labeled as temporary)
  - `state/` - React hooks for state management:
    - `useSeatMapConfig` - Config state management
    - `useSeatMapController` - Derived values (displayMode, zoom threshold)
    - `useSeatMapPrototypeViewState` - Selection, hover, navigation logic
  - `components/` - Feature-specific UI (`SeatMapRoot`, `PrototypeControls`, `MapContainer`)

**Benefits:**
- Easier navigation for team collaboration
- Clear boundaries for testing
- Reusable hooks pattern
- Easy to swap mock data for real API later
- Scales well toward production

**Trade-offs:**
- More indirection (more folders/files to navigate)
- Potentially overkill for prototype, but prepares for production transition

---

*Last updated: Feb 11, 2026*
