# Seating Map Prototype

A prototype for exploring selection logic, interaction patterns, and panel/map synchronization on a concert venue seating map.

## Project Goal

Build an interactive seating map that allows users to browse sections, filter listings, and view ticket details. The prototype uses SVG-rendered shapes (rects, circles) to clearly define logic and interaction patterns before applying visual polish.

---

## Core Concepts

### Hierarchy

```
Venue Map (1)
  └── Sections (many)
        └── Rows (many)
              └── Seats (many)
                    └── Listings (grouped seats sold together)
```

- Only one venue map is visible at a time
- A listing may span multiple adjacent seats in the same row
- Pins float over the map at listing positions showing the lowest price

---

### Display Modes

The map renders different levels of detail depending on zoom level:

| Mode | Visual | Selectable Unit |
|------|--------|-----------------|
| `sections` | Filled rounded rectangle with label | Section |
| `rows` | Horizontal bars per row | Row |
| `seats` | Individual 4×4px seat circles; connector rects link adjacent seats in the same listing (both are interactive) | Listing (grouped seats) |

**Zoom-based switching:**
- Below threshold → renders `config.initialDisplay` (default: `sections`)
- At or above threshold → renders `config.zoomedDisplay` (default: `seats`)

**Thresholds:**
| Layout | Zoom Threshold | Initial Scale |
|--------|---------------|---------------|
| Desktop | 5 | 1.5 |
| Mobile | 3 | 0.5 |

All three modes render SVGs with identical outer dimensions — no visual jumping on mode switch.

---

### Selection State

```typescript
interface SelectionState {
  sectionId: string | null;  // Set whenever anything is selected
  rowId: string | null;      // Set when a row or listing/seat is selected
  listingId: string | null;  // Set when a specific listing is selected
  seatIds: string[];         // The actual seat IDs for the active listing
}
```

**Selection propagates UP:**
- Selecting a listing → sets `sectionId`, `rowId`, `listingId`, `seatIds`
- Selecting a row → sets `sectionId` and `rowId`
- Selecting a section → sets only `sectionId`

**Selection does NOT propagate down:** selecting a section does not select rows or seats.

**Deselection (toggle):** clicking the same element again returns to `EMPTY_SELECTION`. This is level-aware — clicking a section that contains the currently selected row/listing still deselects in one click.

**Single selection only.** No multi-select.

**Availability:** unavailable sections/rows/listings cannot be selected and show no hover or press states.

---

### View Modes

```typescript
type ViewMode = 'listings' | 'detail';
```

| Mode | What's Visible | Triggered By |
|------|---------------|--------------|
| `listings` | Map + listings panel | Default; Back button; section/row tap |
| `detail` | Map + ticket detail overlay | Clicking a listing card or a listing on map |

---

### Listings Panel Filter Logic

The panel filters based on `selection` (passed from the parent — see the EMPTY\_SELECTION guard below):

| Selection State | Panel Shows |
|----------------|-------------|
| `sectionId: null` | All listings |
| `sectionId: 'B'`, `rowId: null` | All listings in section B |
| `sectionId: 'B'`, `rowId: 'B3'` | Only listings in row B3 |

This creates progressive disclosure: section tap → section listings → row tap → row listings → card tap → detail view.

---

### The EMPTY\_SELECTION Guard

In `SeatMapRoot`, the `selection` prop passed to `ListingsPanel` is:

```typescript
const panelSelection = selection.listingId ? EMPTY_SELECTION : viewState.selection;
```

**Why:** while a listing detail is open, `selection.listingId` is set. If the panel received the real selection, it would filter down to a single listing while the detail overlay is covering it — confusing. Passing `EMPTY_SELECTION` lets the panel show all listings in the background, ready to be browsed when the user exits the detail view.

After hitting Back, `listingId` is null again, so the panel gets the real `selection` (which still carries `sectionId`) and the filtered view is revealed as the detail overlay slides out — seamless.

---

## Interaction Model Reference

This section is the **source of truth** for all user-facing interaction behaviors implemented in the prototype. Organized by category, each behavior specifies what the user does, what happens, and any platform differences (Web = desktop, MWeb = mobile).

### Selection

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 1 | Section click toggles selection (single-select; click again to deselect) | ✅ | ✅ |
| 2 | Section click zooms to `threshold + 0.5` with 300ms easeOut | ✅ | ✅ |
| 3 | Unavailable sections: no click handler, default cursor | ✅ | ✅ |
| 4 | Single-select only; clicking a different section replaces the previous | ✅ | ✅ |
| 5 | Can jump directly between sections without returning to full map | ✅ | ✅ |
| 6 | Selection propagates up (listing sets section + row + listing + seatIds) but NOT down | ✅ | ✅ |

### Zoom & Display Modes

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 7 | Continuous freeform zoom (no snapping) | ✅ | ✅ |
| 8 | Zoom-driven display mode: below threshold = sections, at/above = seats | ✅ | ✅ |
| 9 | No intermediate rows-only state by default | ✅ | ✅ |
| 10 | Reset Map button visible only when zoom ≥ threshold | ✅ | ✅ |
| 11 | Reset Map clears zoom + selection (full reset — section context NOT preserved) | ✅ | ✅ |
| 12 | Pinch zoom does not affect selection | — | ✅ |

### Hover

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 13 | Bidirectional hover sync: map hover → panel highlight, panel hover → map highlight | ✅ | — |
| 14 | Section fill transitions to hover color with 150ms CSS ease | ✅ | — |
| 15 | Section label color changes on hover/selection | ✅ | — |
| 16 | Panel hover uses 200ms delay (hover intent) to prevent flicker | ✅ | — |
| 17 | Mobile: hover disabled entirely | — | ✅ |
| 18 | Mobile: no auto-zoom on panel tap | — | ✅ |

### Pins

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 19 | Pin values: lowest price per section (sections mode), per row (rows), per listing (seats) | ✅ | ✅ |
| 20 | Deal score badge on pins when `dealScore > 7` | ✅ | ✅ |
| 21 | Ambient pins hide when their section is selected; selected overlay pin appears | ✅ | ✅ |
| 22 | Hover pin shows cheapest listing in section (sections mode) | ✅ | — |
| 23 | Seat view image + section/row label on hover pin (desktop seats mode) | ✅ | — |
| 24 | Mobile renders `ceil(pins.length / 2)` pins (fewer to reduce clutter) | — | ✅ |
| 25 | Pin density configurable per display mode (sections/rows/seats) | ✅ | ✅ |

### Detail Overlay

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 26 | Desktop: detail slides in over panel (350ms ease) | ✅ | — |
| 27 | Mobile: detail is full-screen overlay | — | ✅ |
| 28 | Detail back button preserves section context (zone row → row selection) | ✅ | ✅ |
| 29 | Panel freeze prevents flash of unfiltered listings during animation | ✅ | ✅ |

### Listings Panel

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 30 | Panel filters to section on section select, to row on row select | ✅ | ✅ |
| 31 | While detail is open, panel receives EMPTY_SELECTION (shows all listings in background) | ✅ | ✅ |

### Layout

| # | Behavior | Web | MWeb |
|---|----------|-----|------|
| 32 | Desktop: 450px sidebar + flex map | ✅ | — |
| 33 | Mobile: map on top (configurable height, default 200px), panel below | — | ✅ |
| 34 | Auto-detection breakpoint: `max-width: 800px` via matchMedia | ✅ | ✅ |
| 35 | Desktop map re-centers on container resize (ResizeObserver) | ✅ | — |

### Not Implemented

These behaviors are acknowledged as out of scope for the current prototype:

- Fallback state if map fails to load
- Loading state / timeout
- Filter interaction (greying out sections, auto-zoom after filter)
- Real-time inventory updates / mid-session sellout handling
- Accessibility (screen reader navigation)
- Deep linking / state persistence
- Swipe gesture between sections on mobile
- Double-tap / long-press handlers on mobile

---

### Handler Reference

Implementation-level detail for each interaction surface.

#### Map Interactions

| Action | Handler | Result |
|--------|---------|--------|
| Click section | `handleSelect(buildSectionSelection(sectionId))` | Selects section; map zooms to it; panel filters to section |
| Click row | `handleSelect(buildRowSelection(sectionId, rowId))` | Selects row; panel filters to row |
| Click listing/seat/connector | `handleSelect(buildListingSelection(...))` | Selects listing; view switches to `detail` |
| Click selected item again | `getToggledSelection()` → `EMPTY_SELECTION` | Full deselect; panel returns to all listings |
| Hover section/row/seat | `handleHoverFromMap(hover)` | Hover pin appears on map; listing card highlights in panel |

#### Listings Panel Interactions

| Action | Handler | Result |
|--------|---------|--------|
| Click listing card | `handleSelectFromPanel(listing)` | Sets full selection; view switches to `detail`; detail overlay slides in |
| Hover listing card | `handleHoverFromPanel(listing)` after 200ms | Hover pin appears on map over that listing's seats |
| Leave listing card | `handleHoverFromPanel(null)` | Hover pin disappears |

#### Ticket Detail Interactions

| Action | Handler | Result |
|--------|---------|--------|
| Click Back | `handleBackToListings()` | `viewMode` → `'listings'`; `listingId` + `rowId` cleared; **`sectionId` preserved** |

**Back preserves section context:** if you browsed into section B and selected a listing, Back returns you to the section-B-filtered panel, not the full list. This is the key design decision.

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Shift+H | Toggle prototype controls panel |

#### Reset Map Button

Visible only when `currentScale >= zoomThreshold`. On click:
1. Animates map back to initial scale/position
2. Calls `setSelection(EMPTY_SELECTION)` directly — bypasses `handleBackToListings`, so **section context is NOT preserved** (full reset is the intent)
3. Button hides itself

---

## State Transitions

### ViewMode State Machine

```
listings ──[card/seat click]──▶ detail
detail   ──[Back button]──────▶ listings (preserves sectionId)
listings ──[section/row tap]──▶ listings (selection updates, viewMode unchanged)
```

### Detail Panel Animation Phases

`detailPhase`: `'closed' | 'entering' | 'open' | 'exiting'`

```
isDetailOpen = viewMode === 'detail'

closed ──[isDetailOpen → true]──▶ entering ──[350ms]──▶ open
open   ──[isDetailOpen → false]─▶ exiting  ──[350ms]──▶ closed
```

**Enter animation (`detailSlideIn`, 350ms, `cubic-bezier(0.215, 0.61, 0.355, 1)`):**
- 0–50%: opacity 0, scale 1.1, translateY 100%
- 51–100%: opacity 1, scale 1, translateY 0
- Simultaneous content blur: `blur(10px)` → `blur(0px)`

**Exit animation (`detailSlideOut`, 350ms, `cubic-bezier(0.55, 0.085, 0.68, 0.53)`):**
- Reverse: slides down and out

### Ticket Detail Content

The overlay is composed of six stacked sections (all scroll together):

| Section | Contents |
|---------|----------|
| **Header** | Seat view image (200px); X/back button top-left |
| **Info** | Section label, row number, ticket count, price per ticket ("ea. · Fees Incl."); deal score badge (if `dealScore > 7`) |
| **Checkout** | Quantity dropdown (1 → `quantityAvailable`) + Checkout button |
| **Perks** | List of seat benefit labels + descriptions (e.g., "Aisle", "Front Row", "VIP") |
| **Delivery** | Delivery method label + description (e.g., "Mobile Transfer") |
| **Event Info** | Event name/date (Calendar icon) + venue name/address (Map Pin icon) |

**Mobile layout difference:** Checkout is removed from the scroll area and pinned as a fixed
footer with a top border — keeps the CTA always visible regardless of scroll position.

---

## Pin System

### Placement

Pins are generated using a **three-pass greedy algorithm** with no hard cap — each listing
produces one candidate pin (positioned at its middle seat), candidates are shuffled
deterministically, then selected across three passes:

| Pass | Chebyshev Distance | Effect |
|------|--------------------|--------|
| 1 | ≥ 2 | Well-spaced pins (3×3 exclusion zone) |
| 2 | ≥ 1 | Adjacent pins allowed |
| 3 | Any (accept all) | Overlapping allowed at high density |

The result is a **priority-ordered** `PinData[]` per section — Pass 1 winners first.
Density filtering (below) then controls how many are actually rendered per mode.

### Visibility Rules

Pins are suppressed to avoid visual overlap with selection/hover overlays:

| Display Mode | Pin Hidden When |
|-------------|----------------|
| `sections` | Any selection or hover in the section |
| `rows` | The selected/hovered listing's row matches the pin's row |
| `seats` | The selected/hovered listing matches the pin's listing |

**Hover pin target suppression:** `getHoverPinTarget` returns `null` (no hover pin) when
the hovered listing already matches the currently selected listing — prevents duplicate
pins stacking at the same position.

### Rendering Count Per Mode

Even when pins are "visible," only a subset renders per display mode:

| Mode | Pins Rendered (per section) |
|------|-----------------------------|
| `sections` | **1** — lowest-price pin only (via `getLowestPricePin`) |
| `rows` | **1 per row** — lowest-price per row (via `getLowestPricePinsByRow`) |
| `seats` | All surviving density-filtered pins |

### Pin Density

`pinDensity: { sections: number; rows: number; seats: number }` controls what fraction of
pins render per display mode. Defaults: `{ sections: 0.80, rows: 0.50, seats: 0.30 }`.

Each mode uses a different filtering strategy:

| Mode | Strategy | Mechanism |
|------|----------|-----------|
| `sections` | Per-section hash gate | `isDensityEnabled(sectionId, density)` |
| `rows` | Per-row hash gate | `isDensityEnabled(rowId, density)` |
| `seats` | Array slice (count ratio) | `getDensityPinSlice(pins, density)` |

**Hash gate (`isDensityEnabled`):** Uses Knuth multiplicative hashing
(`hashString(id) * 2654435761 >>> 0 % 100 < threshold`) to ensure good distribution even
for single-character section IDs (A–H), whose raw ASCII values cluster in 65–72 and would
produce near-identical results with a naive modulo.

**Array slice (`getDensityPinSlice`):** In seats mode, takes the first
`ceil(pins.length * density)` pins — biased toward Pass 1 winners (most spread-out, often
the cheapest).

### Pin Rendering

**Counter-zoom:** Pins scale inversely with the map zoom level so they stay legible at
all scales:
```
inverseScale = (1 / currentScale) × sizeMultiplier
```
Size multipliers: selected = 1.875×, hovered = 1.5×, default = 1.25×. Transform origin
is at the pin tip (bottom-center).

**Visual states:**

| State | Background | Z-index |
|-------|-----------|---------|
| Default | `#1a1a2e` | 10 |
| Hovered | `hoverColor` darkened 60% | 30 |
| Selected | `selectedColor` darkened 60% | 20 |

**Deal score badge:** A green `#4CAF50` badge appears on the pin when `dealScore > 7`.
See [Deal Score](#deal-score) for the full tier system.

**Seat view card:** A 160×100px image preview appears **on hover only** (not on selected
state). Shows the seat view image with a `Section {label}, Row {num}` overlay badge.

**Price display:** Prices are stored in cents; rendered as `$${Math.round(price / 100)}`.

### Overlay Pins

When a listing is selected or hovered, a dedicated overlay pin renders at higher z-index (does not suppress like regular pins do — it replaces them):

| Overlay | Trigger | Size | Z-index |
|---------|---------|------|---------|
| Selected pin | `selection.sectionId === this section` | 1.875× normal | 20 |
| Hover pin | Active `hoverPinTarget` | 1.5× normal | 30 |

**Pin enter animations:**
- Hover: `pinHoverIn` 200ms — slides up 6px, scales from 0.85, fades in
- Selected: `pinSelectedIn` 300ms — slides down 6px (drops in), scales from 0.7, fades in

### Mobile Pin Count

On mobile, only `ceil(pins.length / 2)` regular pins are shown per section to reduce clutter.

---

## Deal Score

Each `Listing` has a `dealScore: number` field (0–10 scale). It drives color tiers and badge
display across three surfaces:

### Color Tiers

| Range | Color | Hex |
|-------|-------|-----|
| ≤ 5.0 | Red | `#D94F4F` |
| ≤ 6.0 | Orange | `#E0873E` |
| ≤ 7.0 | Yellow | `#D4A843` |
| > 7.0 | Green | `#4CAD68` |

(`getDealColor(dealScore)` in `seatMap/config/themes.ts`)

### Badge Surfaces

| Surface | Shown When | Content |
|---------|-----------|---------|
| Price pin | `dealScore > 7` | Green `#4CAF50` box with score number |
| Listing card | `dealScore > 7` | Green pill with score number |
| Ticket detail (Info section) | `dealScore > 7` | Green badge with score + label ("Good" / "Great" / "Excellent") |

---

## Color Themes

`ThemeId = 'branded' | 'neutral' | 'zone' | 'deal'`

Themes control the `SeatColors` object applied to all seat/connector/pin rendering. Selectable
at runtime via prototype controls.

| Theme | Seat Color Strategy |
|-------|---------------------|
| `branded` | Vivid pink (`#CE3197`) — opinionated brand color |
| `neutral` | Muted gray (`#5B6166`) — low visual noise |
| `zone` | Per-section color based on zone group name |
| `deal` | Per-listing color based on `dealScore` (uses Deal Score tiers above) |

### Zone Theme

Zone names map to a 5-tier preset palette with primary/secondary/tertiary variants. Tiers represent seat proximity (1 = closest/most premium):

| Zone Name | Color |
|-----------|-------|
| `tier-1-primary` | `#D95BA0` |
| `tier-1-secondary` | `#EB78A4` |
| `tier-1-tertiary` | `#F29BBC` |
| `tier-2-primary` | `#D9C154` |
| `tier-2-secondary` | `#C1DC6B` |
| `tier-2-tertiary` | `#E3D284` |
| `tier-3-primary` | `#5AADB8` |
| `tier-3-secondary` | `#37C7A0` |
| `tier-3-tertiary` | `#80DAC2` |
| `tier-4-primary` | `#5690D6` |
| `tier-4-secondary` | `#55ADD4` |
| `tier-4-tertiary` | `#82CBF4` |
| `tier-5-primary` | `#7082E5` |
| `tier-5-secondary` | `#8799FF` |
| `tier-5-tertiary` | `#ABB6F4` |
| `alt-close` | `#B99872` |
| `alt-mid` | `#E0B87B` |
| `alt-far` | `#F3BA65` |

Unknown zone names fall back to a deterministic 5-color palette via `hashString(zoneName)`.

### Deal Theme

In sections/rows display modes, each section renders at the color of its cheapest listing's
deal score tier. In seats mode, each listing's seats render at that listing's individual deal
score color — creating a heat map across the section.

---

## Hover Intent

`useHoverIntent(200ms)` delays cross-component hover propagation:

1. Mouse enters → timer starts (200ms)
2. Mouse leaves before timer fires → cancelled, no callback
3. Timer fires → `onHover(listing)` dispatched to map
4. Mouse leaves after callback → `onHover(null)` clears map hover

**Why:** prevents hover flicker from fast mouse passes. Local hover (card highlight) is instantaneous; map/pin updates are delayed.

**Mobile:** hover is fully disabled (`disableHover={true}`) — no map hover pins, no panel-to-map sync.

---

## Mobile vs Desktop

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Layout | 450px sidebar + flex map | Map top (390×200px) + listings below |
| Initial scale | 1.5 | 0.5 |
| Zoom threshold | 5 | 3 |
| Pin count | All pins | `ceil(n/2)` pins |
| Hover | Enabled, 200ms delay | Disabled |
| Min scale | 1.0 | 0.5 |
| Detail panel | Slides over sidebar only | Full-screen overlay |

**Auto-detection breakpoint:** `max-width: 800px` — detected via `matchMedia` and updated
on viewport change. Can be overridden via the prototype controls (auto / desktop / mobile).

### Map Resize Re-centering (Desktop Only)

On desktop, a `ResizeObserver` watches the map container. On each resize:
- Position adjusts by `Δwidth / 2` and `Δheight / 2` to keep the map centered
- Scale is unchanged
- Adjustment is instant (no animation)
- The first callback (fired immediately on `observe()`) records the baseline size
  without adjusting — prevents a spurious shift on mount
- Not active on mobile (fixed-size container, no resize needed)

---

## Complete Interaction Flow Example

**User taps section → refines to row → picks listing → goes back:**

```
1. Tap Section B on map
   → selection: { sectionId: 'B', rowId: null, listingId: null }
   → Map zooms to section B
   → Panel filters to "N listings in Section B"
   → viewMode stays 'listings'

2. Tap row B3 on map (zoomed in enough)
   → selection: { sectionId: 'B', rowId: 'B3', listingId: null }
   → Panel filters to "N listings in Row 3"

3. Hover a listing card for 200ms
   → hoverState set → hover pin appears on map over that listing's seats

4. Click the listing card
   → handleSelectFromPanel(listing)
   → selection: { sectionId: 'B', rowId: 'B3', listingId: 'listing-B-1', seatIds: [...] }
   → viewMode → 'detail'
   → Detail overlay slides in (entering → open)
   → Panel gets EMPTY_SELECTION (guard) → shows all listings in background

5. Click Back
   → handleBackToListings()
   → viewMode → 'listings'
   → selection: { sectionId: 'B', rowId: null, listingId: null, seatIds: [] }
   → Detail overlay slides out (exiting → closed)
   → Panel gets real selection → reveals section-B-filtered list as overlay exits

6. Tap section B again
   → getToggledSelection() detects re-click → EMPTY_SELECTION
   → Panel shows all listings
```

---

## Dimension System

All dimensions use **even numbers** to avoid sub-pixel rendering issues:

```typescript
SEAT_SIZE = 4    // 4×4px seats (center at 2px — whole pixel)
SEAT_GAP  = 2    // 2px horizontal gap between seats
ROW_GAP   = 2    // 2px vertical gap between rows
PADDING   = 1    // 1px padding to prevent edge clipping
```

**Why even numbers:** odd dimensions (e.g., 3px seats) force sub-pixel centers (1.5px), causing visual inconsistencies across browsers and zoom levels. Even dimensions keep all coordinates on whole pixels.

---

## Data Generation

All data is **deterministic via Mulberry32 PRNG**. Each section creates its own RNG with a derived seed — instances are not shared. Changing the map seed regenerates everything.

**Generation pipeline:**
```
SeatMapConfig
  └─ generateSectionData()  →  SectionData (seats, availability)
  └─ generateListings()     →  Listing[] (grouped seats with prices)
  └─ generatePins()         →  PinData[] (three-pass Chebyshev-spaced, priority-ordered)
  └─ createMockSeatMapModel() →  SeatMapModel (assembled model)
```

**Seat zone rows (`seatZoneRows`):** a `SectionConfig` option that marks specific rows as seat zones — rows with unmapped or partially-mapped listings. Each zone row produces 2 listings: one with mapped seats (real seatIds) and one with unmapped seats (synthetic `{rowId}-zone-{n}` seatIds). Zone rows are excluded from both the random unavailability pool and the regular grouping pass. In seats display mode, zone rows render as row-level pill blocks (like RowsView bars) instead of individual seats, and clicking them filters the panel to show the zone row's listings.

**Grouping algorithm:** `generateListings` uses a greedy consecutive-run approach — seats are bucketed by row, consecutive available seats are found, and each run is greedily filled with groups of random size `[min, max]`. Only isolated seats (run length < min) fall through as solo listings. This maximises grouped coverage regardless of unavailability ratio.

**Demo map:** 8 sections around a stage. Sections `101` and `104` have `unavailableRatio: 1.0` (fully sold out). Sections `102` (B) and `1B` (E) have `seatZoneRows` configured — B: rows 3 (60% mapped) & 7 (0% mapped); E: rows 2 (50% mapped) & 6 (0% mapped). All non-sold-out sections use `unavailableRatio: 0.5` targeting ~50% unavailable, ~45% grouped, ~5% solo.

---

## ID Format

IDs are hierarchical strings built by concatenation:

| Level | Format | Example |
|-------|--------|---------|
| Section | Single uppercase letter | `"B"` |
| Row | `{sectionId}{rowNum}` | `"B3"` |
| Seat | `{rowId}-{seatNum}` | `"B3-5"` |
| Listing (grouped) | `"listing-{sectionId}-{n}"` | `"listing-B-1"` |
| Listing (zone row) | `"listing-{sectionId}-zone-{rowNum}-{1\|2}"` | `"listing-B-zone-3-1"` |
| Listing (solo) | `"solo-{sectionId}-{rowId}-{seatNum}"` | `"solo-B-B3-5"` |

*Note: this format assumes single-character section IDs. Numeric IDs (e.g., "101") would need a delimiter.*

---

## Open Questions

1. Should clicking a section/row on the map at low zoom auto-zoom into it, or just select it and filter the panel?
2. What should happen visually when zoomed in after selecting a section but no row/seat is highlighted?
3. Should the panel scroll to the selected listing when entering detail view?

---

## Refactoring History

### February 19, 2026 — Restore Section Context on Back

**Change:** `handleBackToListings` now restores `sectionId` instead of clearing to `EMPTY_SELECTION`. Same fix applied to the toggle-back path in `handleSelectFromPanel`.

**Before:** Back → all listings shown (lost section context)
**After:** Back → section-filtered listings shown (preserves browsing context)

**Key insight:** `SeatMapRoot`'s `selection.listingId ? EMPTY_SELECTION : viewState.selection` guard already handled the visual transition correctly — once `listingId` is null, the panel gets the real selection and reveals the filtered list as the detail overlay slides out. No changes needed in `SeatMapRoot` or `ListingsPanel`.

---

### February 11, 2026 — Domain-Driven Architecture

Restructured codebase from a flat organization to a domain-driven feature folder:

**Before:** All logic in a 455-line `App.tsx`; generators/components/types flat in `components/`

**After:** `App.tsx` is 5 lines. Created `seatMap/` feature folder:
- `config/` — configuration schema and defaults
- `model/` — core domain types
- `behavior/` — business logic rules
- `mock/` — deterministic data generation
- `state/` — React hooks (`useSeatMapConfig`, `useSeatMapController`, `useSeatMapPrototypeViewState`)
- `components/` — feature-specific UI (`SeatMapRoot`, `PrototypeControls`, `MapContainer`)

---

### March 2, 2026 — Seat Zone Rows + Inventory Distribution

**Changes:**
- Added `seatZoneRows?: SeatZoneRowConfig[]` to `SectionConfig` — marks rows as seat zones with configurable mapped/unmapped ratio
- Zone rows produce 2 listings each: one with mapped seats (real seatIds) and one with unmapped seats (synthetic `{rowId}-zone-{n}` seatIds). Unmapped listings have `isUnmapped: true`.
- In seats display mode, zone rows render as row-level pill blocks (like RowsView bars) instead of individual seats. Clicking a zone row filters the panel to show 2 listings for that row.
- Replaced random-start grouping algorithm with greedy consecutive-run grouping: scan each row's available seats, find consecutive runs, fill greedily with groups of `[min, max]` size. Isolated seats (run length < min) remain solo. Eliminates the wasted-iteration problem of the old approach.
- Rebalanced all non-sold-out sections to `unavailableRatio: 0.5`, higher `listingCount`, and `seatsPerListing: [2, 8]` — targeting ~50% unavailable, ~45% grouped, ~5% solo
- Pin dedup fix: zone rows (2 listings each — mapped + unmapped) now collapse to a single pin per row. The algorithm infers zone rows by scanning candidates for any `isUnmapped` listing, then collapses ALL candidates on that `rowIndex` to the cheapest. Default `zoneRowDisplay` changed from `'rows'` to `'seats'`.

---

### March 2, 2026 — Selectable Connectors + Connector Color Controls

**Changes:**
- Connector elements replaced from `<line>` to `<rect>` (same `connectorWidth` height, centered at seat `cy`). Connectors now carry the same click/hover/press event handlers as seat circles — clicking a connector selects the full listing, hovering highlights it across the map and listings panel.
- Added `connectorHover` and `connectorPressed` to `SeatColors` interface and defaults (`#7A1D59` and `#312784`). Connectors use these for hover/pressed feedback instead of the seat circle colors.
- Prototype controls: connector width slider and three connector color pickers (`connector`, `connectorHover`, `connectorPressed`) moved into their own **Connector** accordion section.

---

### March 4, 2026 — Color Themes + Zone Colors + Deal Score

**Changes:**
- Added `ThemeId` (`branded` | `neutral` | `zone` | `deal`) to `SeatMapConfig`. Theme controls
  seat/connector/pin colors globally via the `THEMES` record in `seatMap/config/themes.ts`.
- **Zone theme:** Per-section seat color derived from the section's `zoneName`. Preset palette
  maps `lower`, `lower-edge`, `upper`, `upper-edge` to specific colors; unknown zone names use
  a hash-based fallback palette.
- **Deal theme:** Seat color overridden per-listing (seats mode) or per-section (sections/rows
  modes) using the deal score color tiers from `getDealColor()`.
- Added `dealScore: number` (0–10 scale) field to `Listing`. Drives the 4-tier color system
  (`getDealColor`) and badge display across pins, listing cards, and ticket detail.
- Added `TicketDetail` overlay with six content sections (Header, Info, Checkout, Perks,
  Delivery, EventInfo). Desktop: Checkout inline. Mobile: Checkout pinned as fixed footer.

---

### March 5, 2026 — Large Map Build (Performance + Polish)

**Changes:**
- **Zone palette overhauled:** from 4 flat names (`lower`, `upper`, etc.) to a 5-tier system with
  primary/secondary/tertiary variants (`tier-1-primary` through `tier-5-tertiary`) plus `alt-close/mid/far`.
  Each tier represents seat proximity to the field.
- **`SeatColors` expanded:** added `connectorSelected` (selected connector state), `pinDefault/pinHovered/
  pinPressed/pinSelected` (configurable pin colors), `venueFill`, `venueStroke`, `mapBackground`. All
  now editable at runtime via prototype controls.
- **`PrototypeControls` reorganized** into 3 tabs: Map (venue toggle), Interaction (zoom, layout, pin density,
  scale sliders), Styles (venue colors, inventory colors, connectors, pin colors, section labels).
- **`MapContainer` improvements:** content wrapped in a `div` with 300px padding (provides space for
  viewport culling calculations); `wheelStep` configurable (0.05 for real venue, 0.2 for demo);
  `background` prop drives map background color; gesture idle detection (150ms) disables pointer events
  during active zoom/pan to avoid 18K+ hit-tests per frame; `onAnimationSettle` fires after gesture idle.
- **Scale change optimization:** `handleScaleChange` only triggers React state on threshold crossings
  (not every zoom frame). During programmatic zoom animations (`isAnimatingRef`), threshold crossings are
  deferred until the animation settles — prevents mounting ~18K SVG elements mid-animation.
- **Two-step zoom navigation:** when zoomed out and a listing/row is selected, Step 1 zooms to the section
  (always in DOM) to trigger the display mode switch; Step 2 fires 400ms later to refine to the specific
  row or seat element. Falls back gracefully: seat → row → section if the target element isn't in the DOM.
- **Zone row back navigation:** `handleBackToListings` and `handleSelectFromPanel` detect zone rows
  and return to row-level selection (not section-level) so the zone row listing pair remains filtered.
- **Panel selection freeze:** `panelSelection` now uses a `panelSelectionRef` that freezes on detail
  entry to prevent a flash of unfiltered listings while the overlay animates in.
- **Real venue is default:** `venueMode` starts as `'real'`; `REAL_VENUE_SCALE_DEFAULTS` are applied
  as the initial config defaults (initial: 0.08, threshold: 0.3 for desktop).

---

### March 5, 2026 — Real Venue Map Integration

**Changes:**
- Added a parallel rendering path for real venue SVG data extracted from Figma (Wrigley Field).
  Toggle between demo and real venue via button in the map corner.
- New files: `venueData.json` (extracted data), `createVenueSeatMapModel.ts` (data loader),
  `RealVenue.tsx` (renderer).
- Performance: viewport culling, smart re-render gating, rAF-throttled transforms, no CSS
  transitions on individual elements (~18K seats).
- Wired prototype controls (pin density, connector width, scale sliders, themes) to the real venue.
- Inventory profiles per section: sold-out sections, zone rows, single-listing rows, sold-out
  rows, varied unavailable ratios (72–84%).

See [Figma to Prototype Pipeline](#figma-to-prototype-pipeline) for the repeatable extraction process.

---

## Figma to Prototype Pipeline

A repeatable process for taking any venue SVG in Figma and rendering it in the prototype.

### Prerequisites

- **Figma Desktop** with the Desktop Bridge plugin installed (enables MCP communication)
- **figma-console MCP server** connected to Claude Code
- The venue map must be structured in Figma as described below

### Step 1: Structure the SVG in Figma

The Figma file should follow this hierarchy:

```
Venue Map (frame)
├── Venue Elements (group) — background shapes
│   ├── venue-outline (path)
│   ├── grass (path)
│   ├── dirt (path)
│   └── field (path)
├── Sections (group)
│   ├── section-101 (group)
│   │   ├── boundary (path — section outline/fill shape)
│   │   ├── label (text — "101")
│   │   └── seats (group)
│   │       ├── row-1 (group)
│   │       │   └── circle, circle, circle...
│   │       └── row-2 (group)
│   │           └── circle, circle, circle...
│   ├── section-102 (group)
│   └── ...
└── Stage (path or group, optional)
```

**Key requirements:**
- Seats must be `<circle>` elements (cx/cy used as coordinates)
- Labels must be `<text>` elements (used for section ID extraction)
- Sections must be named groups (name becomes the section ID)
- Boundaries must be `<path>` elements (d attribute preserved for SVG rendering)
- Do NOT outline text on export — keep as `<text>` nodes for label extraction

### Step 2: Extract Data via Figma MCP

Use Claude Code with the Figma MCP tools to traverse the document and extract:

1. **Frame metadata** — overall dimensions (`frameSize: [width, height]`)
2. **Venue elements** — background paths with name, position, dimensions, fill color, and SVG `d` attribute
3. **Section boundaries** — for each section: bounding box (`bx, by, bw, bh`), SVG path `d`, label position (`lx, ly`), row count
4. **Seat positions** — for each section: array of rows, each row is a flat coordinate array `[x1, y1, x2, y2, ...]` in absolute frame coordinates

The extracted data is written to `src/app/seatMap/mock/venueData.json`:

```json
{
  "meta": { "frameSize": [5897, 5978], "sectionCount": 69 },
  "venue": [
    { "name": "outline", "x": 0, "y": 0, "w": 5897, "h": 5978, "fill": "#FFFFFF", "d": "M..." }
  ],
  "sections": {
    "101": { "bx": 100, "by": 200, "bw": 300, "bh": 400, "d": "M...", "lx": 250, "ly": 400, "rows": 15 }
  },
  "seats": {
    "101": [
      [x1, y1, x2, y2, x3, y3, ...],
      [x1, y1, x2, y2, ...]
    ]
  }
}
```

### Step 3: Build the Data Loader

`createVenueSeatMapModel.ts` converts `venueData.json` into a `VenueSeatMapModel`:

1. Parse the JSON into `VenueGeometry` (Maps for section boundaries and seat positions)
2. Build `SectionConfig[]` with inventory profiles per section (unavailable ratios, zone rows, sold-out rows, etc.)
3. Generate `SectionData` using seeded RNG — seat availability, listing grouping
4. Generate `Listing[]` with tiered pricing based on section level
5. Generate `PinData[]` using greedy placement with Chebyshev distance
6. Return the assembled model with geometry attached

**Inventory profiles** are assigned per section via `getInventoryProfile(sectionId)`, which maps section numbers to configurations: unavailable ratio, sold-out rows, zone rows, single-listing rows, and seats-per-listing ranges.

**Pricing tiers** are based on section number:
| Level | Section Numbers | Price Range |
|-------|----------------|-------------|
| Field | < 100 | $150–450 |
| 100-level | 100–199 | $80–250 |
| 200-level | 200+ | $30–120 |

### Step 4: Build the Renderer

`RealVenue.tsx` renders the venue using absolute coordinates (vs. the demo's grid-based layout):

```
<div> (position: relative — enables DOM pin overlays)
  <svg> (full frame dimensions)
    1. Venue background paths (fill from Figma data)
    2. Section boundary paths (interactive in sections mode)
    3. Seats/rows via RealVenueSeats sub-component (viewport-culled)
    4. Section labels
  </svg>
  Pin overlays (DOM elements, absolutely positioned)
</div>
```

**Display modes:**
- `sections` — colored/interactive boundary paths, one pin per section
- `rows` — polylines through seat centers (`strokeWidth = SEAT_RADIUS * 2`), row-level interaction
- `seats` — individual circles with connectors; zone rows render as polylines

**Viewport culling:** only sections whose bounding box intersects the viewport (+ 300px padding) render their seats. The visible set is tracked via AABB intersection and React state only updates when the set changes.

### Step 5: Wire into SeatMapRoot

- Add a toggle state (`venueMode: 'demo' | 'real'`)
- Load both models via `useMemo` (demo + real)
- Pass `viewportRect` and transform callbacks for culling
- Real venue uses different scale defaults (initial: 0.08, threshold: 0.3 for desktop)
- All prototype controls (pin density, connector width, themes, scale sliders) pass through to both paths

### Adapting for a New Venue

To integrate a different venue:

1. Set up the SVG in Figma following the structure above
2. Use Figma MCP to extract data into a new JSON file (or overwrite `venueData.json`)
3. Update `getInventoryProfile()` if the new venue has different section numbering
4. Adjust pricing tiers if needed
5. Adjust scale defaults in `REAL_VENUE_SCALE_DEFAULTS` based on the new frame dimensions

The renderer (`RealVenue.tsx`) and data loader are venue-agnostic — they work with any `venueData.json` that follows the schema.

### ID Format (Real Venue)

Real venue uses delimited IDs (unlike the demo's concatenated format):

| Level | Format | Example |
|-------|--------|---------|
| Section | Numeric string | `"12"` |
| Row | `{sectionId}-{rowNum}` | `"12-3"` |
| Seat | `{rowId}-{seatNum}` | `"12-3-5"` |
| Zone seat | `{rowId}-zone-{seatNum}` | `"12-3-zone-5"` |
| Listing | `"listing-{sectionId}-{n}"` | `"listing-12-1"` |
| Zone listing | `"listing-{sectionId}-zone-{rowNum}-{1\|2}"` | `"listing-12-zone-3-1"` |
| Row listing | `"listing-{sectionId}-row-{rowNum}"` | `"listing-12-row-10"` |

*Last updated: Mar 5, 2026 (large-map-build branch)*
