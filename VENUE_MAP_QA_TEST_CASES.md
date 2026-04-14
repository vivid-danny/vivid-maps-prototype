# Venue Map Interaction — QA Test Cases

Consolidated test plan for the MapLibre venue seating map. Synthesized from the [Venue Map Interaction Model Decisions](https://vividseats.atlassian.net/wiki/spaces/MS/pages/5397643272/Venue+Map+Interaction+Model+Decisions) Confluence page, the prototype's internal documentation (`INTERACTION.md`, `DETAIL_AVAILABILITY.md`, `PROJECT.md`), and the prototype source code.

This document is organized by interaction area. Each area contains a brief summary of expected behavior followed by numbered test cases. Platform-specific expectations (Desktop, Mobile Web, App) are called out inline.

---

## 1. Page Load and Initial State

**Expected behavior:** The map loads at section level, fit to its container. The map is not interactive until inventory is available. A venue skeleton or SVG fallback displays while loading.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 1.1 | Load event page with valid venue map | Map renders at section-level zoom, fit to the container. All sections with inventory appear in their theme colors. Price pins are visible with collision-based decluttering. | All |
| 1.2 | Load event page — slow connection | A venue skeleton (venue geometry without inventory colors) or the SVG fallback map displays while the MapLibre map loads. | All |
| 1.3 | Map fails to load within timeout (~3 seconds) | Map falls back to the existing SVG map experience. | All |
| 1.4 | Browser does not support WebGL / MapLibre | SVG map fallback renders instead of a broken canvas. | All |
| 1.5 | Sections with no available inventory on load | Those sections appear in an unavailable/greyed-out state. They do not show price pins. | All |

---

## 2. Section Interaction

### 2.1 Selection

**Expected behavior:** Sections are single-select. Selecting a section filters the listing panel, zooms/pans toward the section, and mutes other sections. Unavailable sections are not selectable.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 2.1.1 | Click an available section | Section receives selected treatment. Map eases (animated zoom + pan) toward the section. Listing panel filters to that section's inventory. Sections outside the selected section are muted. | All |
| 2.1.2 | Click the same selected section again | Selection clears. Map returns to showing all sections unfiltered. Listing panel returns to the full list. | All |
| 2.1.3 | Click a different section while one is already selected | Previous section deselects. New section receives selected treatment. Listing panel updates to the newly selected section. | All |
| 2.1.4 | Click an unavailable (no inventory) section | Nothing happens. No selection, no zoom, no panel change. | All |
| 2.1.5 | Click a section while a row inside it is selected | Selection moves up to section-level. Row selection clears. This is treated as a level change, not a full deselect. Listing panel shows all listings for that section. | All |
| 2.1.6 | Click a section while a row in a *different* section is selected | Previous row and section deselect. New section is selected and panel filters to it. | All |

### 2.2 Hover (Desktop Only)

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 2.2.1 | Hover over an available section | Section hover treatment appears (overlay). Cursor changes to pointer. Price pin enters hovered state. | Desktop |
| 2.2.2 | Hover over an unavailable section | No hover treatment. Cursor remains default. | Desktop |
| 2.2.3 | Move mouse off a hovered section | Hover treatment clears immediately. | Desktop |
| 2.2.4 | Hover a section on mobile | No hover effect occurs (hover is disabled on mobile). | MWeb / App |

### 2.3 Price Pins at Section Level

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 2.3.1 | Observe section-level price pins on load | Pins display the lowest price per section. Pins are decluttered via collision detection — not every section will have a visible pin. Distribution is roughly even across the venue. | All |
| 2.3.2 | Select a section | Price pins within the selected section appear (with collision detection). The selected section's pin enters a selected visual state. | All |
| 2.3.3 | Hover a section (desktop) | A hover pin appears if the section doesn't already have a visible static pin. Hover pin shows the cheapest listing. | Desktop |

---

## 3. Zoom Behavior

**Expected behavior:** Zoom is continuous (freeform), not snapped. Layer transitions happen at zoom thresholds. Current prototype thresholds: sections visible up to zoom ~14, rows appear above ~14, seats appear above ~16.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 3.1 | Pinch-zoom in on mobile | Map zooms continuously. When zoom crosses the row threshold (~14), row geometry fades in. When zoom crosses the seat threshold (~16), seat circles and connectors appear. | MWeb / App |
| 3.2 | Scroll-zoom in on desktop | Same layer transitions as pinch-zoom. | Desktop |
| 3.3 | Zoom out past the row threshold | Row and seat layers hide. Map returns to section-only display mode. | All |
| 3.4 | Select a section (auto-zoom) | Map eases to a closer section-focused zoom. This is a closer view of the section, not an automatic jump to seat level. | All |
| 3.5 | Select a row (auto-zoom) | Map eases closer to that row. | All |
| 3.6 | Select a listing from the panel (auto-zoom) | Map eases to the listing's location on the map (desktop). | Desktop |
| 3.7 | Zoom does not snap | Verify that at no point does the zoom "snap" to a fixed level. The user can rest at any intermediate zoom value. | All |
| 3.8 | Double tap on a section (mobile) | Incremental zoom toward that area. | MWeb / App |
| 3.9 | Long press on a section (mobile) | Zoom to rows/seats level for that section. | MWeb / App |
| 3.10 | Pinch-zoom does not affect section selection | If a section is selected and the user pinches to zoom, the selection is preserved (pinch does not select or deselect). | MWeb / App |

---

## 4. Reset Map

**Expected behavior:** A "Reset Map" button appears when zoom is at or above the row threshold. Pressing it clears all state and fits the map back to venue bounds.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 4.1 | Observe reset button visibility at section zoom | Button is hidden (map is already at default zoom). | All |
| 4.2 | Zoom into rows — observe reset button | Button appears once the zoom crosses the row threshold. | All |
| 4.3 | Click the reset map button | Selection clears completely. Hover clears. View mode returns to `listings`. Map fits back to venue bounds. Display returns to section-level. | All |
| 4.4 | Confirm reset does not preserve section context | After reset, listing panel shows all listings, not filtered to the previously selected section. | All |
| 4.5 | App-specific: back button on listing panel | Resets selection and map (different from the reset map button which preserves selection per Confluence decision). | App |
| 4.6 | Web/MWeb: reset map button behavior | Preserves selection, resets map position (per Confluence). Verify this matches the implemented behavior. | Web / MWeb |

> **Note:** There is a discrepancy between the Confluence doc (reset preserves selection on Web/MWeb) and the prototype doc (reset clears selection completely). This should be confirmed with product before finalizing.

---

## 5. Pan

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 5.1 | Drag the map | Map pans in the drag direction. No selection or hover changes. | All |
| 5.2 | Pan to another section while one is selected | Selection remains. The map simply moves. | All |

---

## 6. Row Interaction

### 6.1 Selection

**Expected behavior:** Rows are single-select. Selecting a row also implicitly selects its parent section. Unavailable rows fall back to selecting the parent section.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 6.1.1 | Click an available row | Row receives selected treatment. Parent section is implicitly selected. Listing panel filters to that row's inventory. Sibling available rows are muted. | All |
| 6.1.2 | Click the same selected row again | Selection clears entirely. Listing panel returns to all listings. | All |
| 6.1.3 | Click a different row in the same section | Previous row deselects. New row is selected. Panel updates. | All |
| 6.1.4 | Click a row in a different section | Previous row and section context clear. New row and its section are selected. Panel filters accordingly. | All |
| 6.1.5 | Click an unavailable row (no inventory) | The parent section is selected instead (if the section has inventory). If the parent section is also unavailable, nothing happens. | All |
| 6.1.6 | Observe rows without inventory | Rows without inventory are still visible on the map (not hidden). They appear in an unavailable state immediately when detail geometry loads. | All |

### 6.2 Hover (Desktop Only)

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 6.2.1 | Hover an available row | Row hover treatment appears. Cursor changes to pointer. | Desktop |
| 6.2.2 | Hover an unavailable row | No hover treatment. No pointer cursor. | Desktop |
| 6.2.3 | Hover a row in a different section while a row is selected | The hovered section's rows temporarily reveal through the muted overlay (hover-reveal behavior). | Desktop |
| 6.2.4 | Leave a hovered row | Hover clears immediately. | Desktop |

### 6.3 Row Muting

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 6.3.1 | Select a row — observe sibling rows | Available sibling rows are muted. Unavailable sibling rows remain in their unavailable state (not double-muted or hidden). | All |
| 6.3.2 | Select a row — observe rows in other sections | All rows in other sections are muted. | All |

### 6.4 Rows with Mixed Inventory (Seat Saver / Zone)

**Expected behavior:** Rows with zone/Seat Saver listings (no specific seat numbers) display with a thick line style. The whole row is selectable.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 6.4.1 | Observe a row with only unmapped (Seat Saver) listings | Row appears available. Row is selectable. Clicking it shows associated listings in the panel. Seats within the row remain unavailable (no seat-level circles light up). | All |
| 6.4.2 | Observe a row with mixed mapped and unmapped listings | Row is available. Mapped seats show as available circles. Unmapped listings are accessible from the panel but do not create seat-level visuals. | All |
| 6.4.3 | Select a row with unmapped listings, then view in seats mode | Mapped seats are interactive. Unmapped listings appear in the listing panel but not on the seat map. No synthetic seat coverage is created. | All |

---

## 7. Seat and Listing Interaction

### 7.1 Seat Selection

**Expected behavior:** Clicking a seat resolves to listing-level selection. All seats in that listing highlight together. Detail view opens.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 7.1.1 | Click an available seat | Selection resolves to the listing that owns the seat. All seats in that listing are marked selected. Parent row and section are set. View mode changes to `detail`. Detail view opens. | All |
| 7.1.2 | Click an unavailable seat | Nothing happens. No selection, no detail view. | All |
| 7.1.3 | Click a connector line | Selection resolves to that connector's listing. Same outcome as clicking one of the listing's seats. | All |

### 7.2 Seat Hover (Desktop Only)

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 7.2.1 | Hover an available seat | Hover resolves to the listing. All seats in that listing highlight together. The connector for that listing also enters hovered state. | Desktop |
| 7.2.2 | Hover a connector | Same result as hovering one of the listing's seats — all seats and the connector highlight. | Desktop |
| 7.2.3 | Move between seats within the same listing | Hover stays active (no flicker). The 60ms grace window prevents flicker when the pointer crosses gaps between seats/connector. | Desktop |
| 7.2.4 | Move from a seat to a different listing's seat | Previous listing unhighlights. New listing highlights. | Desktop |
| 7.2.5 | Hover an unavailable seat | No hover treatment. | Desktop |

### 7.3 Seat Muting

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 7.3.1 | Select a section — observe seats in other sections | Seats and connectors outside the selected section are muted/filtered. | All |
| 7.3.2 | Hover a listing in a muted area | The hovered listing's seats reveal through the muted overlay. | Desktop |

---

## 8. Listing Panel Synchronization

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 8.1 | Select a section on the map | Listing panel filters to that section's listings. | All |
| 8.2 | Select a row on the map | Listing panel filters to that row's listings. | All |
| 8.3 | Click a listing card in the panel | Listing becomes active selection. `viewMode` changes to `detail`. Detail view opens. On desktop, the map navigates to that listing's location. | All |
| 8.4 | Hover a listing card in the panel (desktop) | Corresponding listing highlights on the map (seats, connector, and/or section depending on zoom level). Hover is effectively immediate (no perceptible delay). | Desktop |
| 8.5 | Click an already-open listing card again | Detail view closes. Browsing returns to `listings` mode. If the listing came from a zone row, row context is restored. Otherwise section context is preserved. | All |
| 8.6 | Detail view is open — observe listing panel in background | The panel keeps the broader browsing context (section or row filter) visible in the background. It does not collapse to only the active listing. | All |

---

## 9. Detail View

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 9.1 | Open detail from a listing selection | Desktop: detail overlays the panel area. Mobile: detail opens as a full overlay over the map and panel. | All |
| 9.2 | Press "Back" from detail | `viewMode` returns to `listings`. `listingId` clears. Section context is preserved — user returns to the previously scoped browsing state, not the full unfiltered list. | All |
| 9.3 | Back from detail for a zone-row listing | User returns to row-level selection for that zone row (not just section level). | All |
| 9.4 | While detail is open, listing panel does not re-filter | Panel filtering is paused while detail is open. The background panel state does not change. | All |

---

## 10. Pins and Tooltips

**Expected behavior:** Pins are MapLibre `Marker` overlays. They are density-limited and decluttered. Their scope changes by display mode.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 10.1 | Pins at section zoom level | Section-level price pins visible. Shows lowest price per section. Even distribution across the venue via decluttering. | All |
| 10.2 | Pins at row zoom level | Row-scoped pins visible. Shows lowest price per row. | All |
| 10.3 | Pins at seat zoom level | Listing-scoped pins visible. | All |
| 10.4 | Click a section-level pin | Selects the section (same as clicking the section polygon). | All |
| 10.5 | Click a row-level pin | Selects the row. | All |
| 10.6 | Click a listing-level pin | Selects the listing and opens detail view. | All |
| 10.7 | Hover a section with no static pin (desktop) | A hover pin appears on-the-fly showing the cheapest listing for that section. | Desktop |
| 10.8 | Pin z-index ordering | Hover pins (z=30) appear above selected pins (z=20), which appear above default pins (z=10). | All |
| 10.9 | Mobile pin density | Mobile shows roughly 2/3 the number of pins compared to desktop. | MWeb / App |
| 10.10 | Pins do not update dynamically mid-session | Pins only update on user interaction (selection, zoom), not from background inventory changes. | All |

---

## 11. Theming and Colors

**Expected behavior:** Three supported themes: `branded`, `zone`, `deal`. Theme determines section fill colors, pin styling, and overlay treatments.

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 11.1 | Branded theme — section colors | Sections use a uniform base color. Hover and selection states apply overlays on top. | All |
| 11.2 | Zone theme — section colors | Each section/zone has a distinct color from a per-section match expression. | All |
| 11.3 | Deal theme — section colors | Sections colored by pricing/deal tiers. | All |
| 11.4 | Unavailable section appearance | Regardless of theme, unavailable sections appear in a distinct unavailable state (greyed out / desaturated). | All |
| 11.5 | Selection overlay | Selected section has a visible overlay distinguishing it from hovered and default states. | All |
| 11.6 | Hover overlay vs. selection overlay | Hover and selection are visually distinct from each other. | Desktop |
| 11.7 | Muted overlay for unselected sections/rows | When a section or row is selected, unrelated geometry is visually muted (reduced opacity/saturation). | All |

---

## 12. Filtering Interaction

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 12.1 | Apply a price filter | Sections with no qualifying inventory grey out (same appearance as unavailable). Map does not auto-zoom or pan. Price pins update to reflect filtered inventory. | All |
| 12.2 | Apply a quantity filter | Same behavior as price filter — ineligible sections grey out. | All |
| 12.3 | Clear a filter | Filter is removed. Map does not restore any previous zoom/selection state — it simply removes the filter constraint. | All |
| 12.4 | Row goes out of scope due to filter change | The row becomes hidden since it no longer matches the filter. Listing panel updates on the next user interaction (tap a different section, row, or seat). | All |
| 12.5 | Apply a filter while a section is selected | Selected section updates its inventory and availability. If the section becomes empty after the filter, it should appear unavailable. | All |
| 12.6 | Recommended listings filter changes inventory | Map refreshes to reflect the new effective inventory model. Row and seat availability re-derives from the new listing set. | All |

---

## 13. Navigation Between Sections

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 13.1 | Pan from one section to another while zoomed in | User can manually navigate between sections without returning to full map first. | All |
| 13.2 | Click a section visible at row/seat zoom | The new section is selected directly. No need to zoom out first. | All |
| 13.3 | No swipe gesture for section navigation on mobile | Swiping on the map pans only; there is no gesture to jump between sections. | MWeb / App |

---

## 14. Platform-Specific Behavior

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 14.1 | Desktop layout | Map and listings panel are side by side. Hover is enabled. Detail opens over the panel area. | Desktop |
| 14.2 | Mobile layout | Map is above the panel. Hover is disabled. Detail opens as a full overlay. | MWeb / App |
| 14.3 | Section labels on mobile | Section labels scale appropriately for mobile viewports. | MWeb / App |

---

## 15. Edge Cases and Guardrails

| # | Test Case | Expected Result | Platform |
|---|-----------|-----------------|----------|
| 15.1 | Click the map background (not on any feature) | Any current selection is cleared. | All |
| 15.2 | Rapidly click multiple sections | Only the last-clicked section is selected (no multi-select, no race conditions). | All |
| 15.3 | Zoom in past the seat threshold with no section selected | Seat geometry for all sections is visible. Seats with inventory are available; seats without are unavailable. Nothing is muted because nothing is selected. | All |
| 15.4 | Select a listing, go to detail, then use browser back | Map restores last state (per deep linking / state persistence decisions). | Web / MWeb |
| 15.5 | Seat data is unavailable for a venue | Map falls back to row-level display as the most detailed available layer. | All |
| 15.6 | Section-only unmapped listing (row and seats unknown) | Listing appears in the panel and detail only. It does not create row-level availability on the map. | All |

---

## Open Items (from Confluence 🔴)

These are decisions still marked as in-progress or blocked in the Confluence doc. QA should confirm the expected behavior with product before writing regression tests for these areas.

1. **Discrete vs. continuous zoom (Web / MWeb)** — currently implemented as continuous in the prototype. Web/MWeb decision is still TBD.
2. **Exact zoom thresholds for layer transitions** — prototype uses ~14 (rows) and ~16 (seats). Final values to be confirmed.
3. **Min/max zoom levels** — not finalized in Confluence.
4. **Reset map: selection preservation** — Confluence says Web/MWeb reset preserves selection but resets position; prototype resets everything. Needs alignment.
5. **Mid-session seat unavailability** — what happens if a selected seat sells out during the session (FE won't know until page refresh).
6. **Deep linking with section pre-selected** — not confirmed if URL params support this.
7. **App tab-switching state restoration** — not decided.
