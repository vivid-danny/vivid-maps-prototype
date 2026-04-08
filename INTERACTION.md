# Venue Map Interaction Reference

Behavior reference for the current prototype.

This file is meant to align product and engineering on what the map currently does. It is intentionally behavior-first:

- user action
- resulting state change
- visible outcome
- important constraints or edge cases

For row/seat inventory implementation constraints, see [DETAIL_AVAILABILITY.md](./DETAIL_AVAILABILITY.md).

## State Model

### Selection

```ts
interface SelectionState {
  sectionId: string | null;
  rowId: string | null;
  listingId: string | null;
  seatIds: string[];
}
```

Rules:

- only one selection is active at a time
- selecting a child also selects its ancestors
- selecting a parent does not select its children
- clicking the same selected target toggles selection off

### Hover

```ts
interface HoverState {
  listingId: string | null;
  sectionId: string | null;
  rowId: string | null;
}
```

Rules:

- desktop only
- section and row hover are level-specific
- seat hover resolves to listing-level hover

### View Mode

```ts
type ViewMode = 'listings' | 'detail';
```

Rules:

- section and row selection keep the user in `listings`
- listing selection opens `detail`
- backing out of `detail` preserves browsing context

## Map Zoom

### Pinch zoom

User action:

- user pinches or scroll-zooms the map

State result:

- zoom changes continuously
- display mode changes when zoom crosses the configured threshold

Visible result:

- below threshold the map stays in section mode
- above threshold the map switches into the configured zoomed display mode

Notes:

- the prototype currently uses continuous zoom
- there is no special long-press zoom behavior
- there is no double-tap zoom behavior documented in the current prototype

### Section-driven zoom

User action:

- user selects a section

State result:

- section becomes the active selection

Visible result:

- map eases toward that section
- this is a closer section-focused zoom, not an automatic jump straight to a specific row

### Row or listing-driven zoom

User action:

- user selects a row or listing

State result:

- row or listing becomes active

Visible result:

- map eases closer to that row or listing context

### Reset map button

User action:

- user clicks the reset map button

Visible precondition:

- the button is only shown once the current zoom is at or above the row threshold

State result:

- selection clears completely
- hover clears
- view mode returns to `listings`

Visible result:

- map fits back to venue bounds
- display mode drops back to the zoomed-out section state

Important nuance:

- reset is a full reset
- it does not preserve section context

## Pan

### Drag pan

User action:

- user presses / drags the map

Visible result:

- map pans normally

## Section Interaction

### Section select

User action:

- user clicks an available section on the map

State result:

- `selection = { sectionId, rowId: null, listingId: null, seatIds: [] }`

Visible result:

- section becomes selected
- panel filters to that section
- map navigates toward that section

### Section single-select behavior

Rules:

- sections are single-select when interacting directly with the map
- selecting a different section replaces the previous section selection

### Section deselect

User action:

- user clicks the same already-selected section again

State result:

- selection clears

Visible result:

- panel returns to all listings
- section selection visuals clear

### Section click while a row or listing in that section is selected

User action:

- user clicks the parent section while a row or listing in that section is currently selected

State result:

- selection moves up to section-level selection

Visible result:

- this is treated as a level change, not an immediate full deselect

### Unavailable sections

Rules:

- unavailable sections are not selectable
- unavailable sections do not hover

## Row Interaction

### Row select

User action:

- user clicks an available row

State result:

- `selection = { sectionId, rowId, listingId: null, seatIds: [] }`

Visible result:

- row becomes selected
- parent section is implicitly selected
- panel filters to that row

### Row single-select behavior

Rules:

- rows are single-select
- selecting a new row clears the previous row selection
- selecting a row in a different section replaces both the previous row and its parent section context

### Row deselect

User action:

- user clicks the same already-selected row again

State result:

- selection clears

Visible result:

- row selection visuals clear
- panel returns to all listings

### Unavailable rows

Rules:

- unavailable rows remain visible as unavailable
- unavailable rows do not hover
- unavailable rows are not selectable as rows

Fallback click behavior:

- clicking an unavailable row selects the parent section if that section has inventory
- if the parent section is also unavailable, nothing happens

### Row availability visibility

Rules:

- rows without inventory are still shown
- they are not hidden from the map
- they should appear unavailable immediately when detail geometry is shown

## Seat And Listing Interaction

### Seat select from the map

User action:

- user clicks an available seat

State result:

- interaction resolves to listing-level selection
- `selection.sectionId` and `selection.rowId` are set
- `selection.listingId` is resolved from the clicked seat's listing
- `selection.seatIds` becomes the full seat set for that listing

Visible result:

- detail view opens
- map reflects the selected listing

### Connector select

User action:

- user clicks a seat connector

State result:

- selection resolves directly to that connector's listing

Visible result:

- same outcome as selecting the listing from a seat

### Listing card select

User action:

- user clicks a listing card in the panel

State result:

- listing becomes the active selection
- `viewMode = 'detail'`

Visible result:

- ticket detail opens
- on desktop, map navigation follows the selected listing
- on mobile, detail opens as an overlay without desktop-style panel layering

### Listing toggle from detail

User action:

- user clicks the already-open listing again from the panel

State result:

- detail closes

Visible result:

- browsing returns to listings mode
- if the listing came from a zone row, row context is restored
- otherwise section context is preserved

### Unavailable seats

Rules:

- unavailable seats are visible as unavailable
- unavailable seats do not hover
- unavailable seats do not select

## Hover Interaction

### Section hover

User action:

- user hovers an available section on desktop

State result:

- `hoverState = { sectionId, rowId: null, listingId: null }`

Visible result:

- section hover treatment appears
- cursor changes to pointer

### Row hover

User action:

- user hovers an available row on desktop

State result:

- `hoverState = { sectionId, rowId, listingId: null }`

Visible result:

- row hover treatment appears
- cursor changes to pointer
- any prior seat/listing hover state is cleared

### Seat hover

User action:

- user hovers an available seat on desktop

State result:

- hover resolves to that seat's listing
- all seats in that listing are marked hovered together
- connector for that listing is hovered too
- `hoverState = { sectionId, rowId: null, listingId }`

Visible result:

- the whole listing highlights together

### Connector hover

User action:

- user hovers a connector on desktop

State result:

- hover resolves to the connector's listing
- the listing's seats and connector all become hovered

Visible result:

- same visual result as hovering one of the listing's seats

### Hover exit behavior

Rules:

- leaving a section or row clears hover immediately
- leaving a seat or connector uses a short grace window so moving between seats and connectors does not flicker
- mobile disables map hover entirely

### Panel hover

User action:

- user hovers a listing card on desktop

State result:

- `hoverState = { listingId, sectionId, rowId }`

Visible result:

- corresponding listing highlights on the map

Timing note:

- current panel hover propagation is effectively immediate

## Pins And Tooltips

The prototype uses pin overlays rather than a single universal tooltip system.

### Pin scope by display mode

Visible behavior:

- section mode shows section-level pins
- row mode shows row-scoped pins
- seats mode shows listing-scoped pins

### Pin quantity behavior

Visible behavior:

- pins are density-limited and decluttered
- not every possible section, row, or listing pin is always shown at once

### Pin interaction

User action:

- user clicks a pin

State result:

- selection resolves according to the current display mode

Visible result:

- section pin click selects the section
- row pin click selects the row
- listing pin click selects the listing and opens detail

### Hover-linked pin behavior

Visible behavior:

- hovered listing context can surface as a hover pin
- selected listing context can surface as a selected pin
- pins are suppressed or replaced when they would conflict with stronger selected/hovered context

## Muting Behavior

### Section selected

Visible result:

- in zoomed-in modes, rows outside the selected section mute
- in seats mode, seats and connectors outside the selected section mute

### Row selected

Visible result:

- selected row gets selected treatment
- sibling available rows mute
- unavailable sibling rows remain unobscured
- rows in other sections mute

### Hover reveal

Visible result:

- hovering a row in another section temporarily reveals that hovered section's row context
- in seats mode, hovered listing seats reveal through the muted overlay

## Detail View

### Open detail

User action:

- user selects a listing from the map or panel

State result:

- `viewMode = 'detail'`

Visible result:

- desktop: detail overlays the panel area
- mobile: detail overlays the full map + panel viewport

### Back from detail

User action:

- user presses Back / closes detail

State result:

- `viewMode = 'listings'`
- `listingId` clears
- section context is preserved

Visible result:

- user returns to the previously scoped browsing state instead of the full list

Zone-row exception:

- if the selected listing came from a zone row, Back returns the user to row-level selection for that zone row

### Panel while detail is open

Visible result:

- panel keeps the broader browsing context in the background
- it does not collapse to only the active listing while detail is open

## Platform Differences

### Desktop

- hover enabled
- listings panel visible beside the map
- detail opens over the panel area

### Mobile

- map hover disabled
- map above panel layout
- detail opens as a full overlay

## Guardrails

- preserve single-select behavior
- preserve ancestor propagation rules
- preserve unavailable-row fallback-to-section behavior
- preserve listing-scoped seat hover
- preserve section context when backing out of detail
- preserve rows-without-inventory visibility as unavailable, not hidden
- preserve immediate row/seat availability when detail geometry appears
