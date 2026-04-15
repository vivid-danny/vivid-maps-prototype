# Mixed Inventory Rules

Rules for displaying listings that have incomplete seat mapping information. These rules are independent of any specific venue or map renderer.

## Listing Mapping Levels

A listing arrives from the seller with one of three levels of seat specificity:

| Level | Row known? | Seats known? | Description |
|---|---|---|---|
| Mapped | Yes | Yes | Seller provided exact row and seat numbers |
| Row-unmapped | Yes | No | Seller provided a row but not individual seats |
| Section-unmapped | No | No | Seller did not provide a recognizable row or seats |

## Display Rules

### Location Label

| Level | Format | Example |
|---|---|---|
| Mapped | Section {section}, Row {row} | Section 214, Row 3 |
| Row-unmapped | Section {section}, Row {row} | Section 214, Row 5 |
| Section-unmapped | Section {section}, Row {row} | Section 214, Row 9 |

Section-unmapped listings are assigned to the last row of their section for display purposes. All listings show a row.

### Seat Numbers

- Mapped listings show seat numbers (e.g., "2 tickets, Seats 3-4")
- Row-unmapped and section-unmapped listings show only ticket count (e.g., "2 tickets")

### Messages

**Seated Together** -- shown when listing quantity is greater than 1:

- With row: "Experience it live -- together in Row {row}"
- Without row: "Experience it live -- together"

**Unrecognized Row Note** -- shown only for section-unmapped listings:

> We don't recognize the row(s) listed for this ticket, so we're displaying it in the last row of this section.

No note is shown for mapped or row-unmapped listings.

## Map Rendering Rules

### Row Availability

A row renders as available if any listing exists for that row -- mapped or unmapped.

### Seat Availability

A seat renders as available only when one of these is true:

- a mapped listing explicitly includes that seat
- an unmapped listing wins visual coverage for the row (see below), in which case all seats in the row render as available

### Visual Coverage Competition

When a row contains only unmapped listings (no mapped listings), the unmapped listings compete for visual representation on the map. One listing wins; the rest become panel-only.

**Winner selection priority:**

1. Lowest price
2. Highest deal score (tiebreaker)
3. Alphabetical listing ID (final tiebreaker)

**Winner behavior:**

- all seats in the row are visually attributed to the winner
- the winner's pin appears on the map
- the winner's seats render as available

**Mapped listings always take priority.** If a row contains any mapped listing, unmapped listings in that row do not compete -- they are automatically panel-only.

### Panel-Only Listings

An unmapped listing that does not win visual coverage:

- appears in the listing panel when its section or row is selected
- does not have a pin on the map in seat-level view
- shows a non-interactive hover indicator when hovered from the panel (visual feedback only, not clickable on the map)

## Listing Panel Filtering

- When a section is selected: all listings in the section appear, including all unmapped types
- When a row is selected: only listings assigned to that row appear
- Section-unmapped listings are assigned to the last row, so they appear when the last row is selected

## Seat Tap Rules

When a user taps a seat on the map:

- **Mapped listing:** Always opens the listing's ticket detail directly, regardless of how many other listings share the row.
- **Unmapped listing, single listing in row:** Opens the listing's ticket detail directly.
- **Unmapped listing, multiple listings in row:** Selects the row and shows all listings in the panel. Does not auto-select a listing, since the user's preference is unknown.

Tapping a listing card in the panel always opens its ticket detail.

## Navigation Rules

### Dismiss Ticket Detail

Closing the ticket detail view returns to the listing panel and recenters the map on the row the listing was in.

---

## Prototype Test Scenarios

The prototype exercises these rules in sections 214, 316, and 24. Each section contains nine deterministic listings across five rows that cover every combination above.

### Row Layout Per Section

**Row A -- Unmapped-only row.** All seats are unavailable on the map. Contains one row-unmapped listing (quantity 2). It wins visual coverage for the row unopposed.

**Row B -- Fully mapped row.** One listing owns every seat. All seats render as available. Selecting the listing highlights all seats and draws connectors.

**Row C -- Mixed mapped and unmapped row.** A mapped listing owns the first two seats. A row-unmapped listing (quantity 2) also exists in this row. The mapped listing takes visual priority. The unmapped listing is panel-only but still appears in the listing panel when this row is selected.

**Row D -- Back row with section-unmapped bucket.** Three listings share this row: one row-unmapped listing (quantity equals the row's full seat count) and two section-unmapped listings (quantity 2 each, assigned here because they had no row). All three compete for visual coverage.

**Row E -- Multi-mapped row.** Two mapped listings share the row: one owns seats 1-2 (quantity 2) and the other owns seats 3-6 (quantity 4). Remaining seats are unavailable. Tapping a seat opens the listing that owns it directly.

### Coverage Matrix

| Row | Listing type(s) | Visual coverage winner | Panel-only listings |
|---|---|---|---|
| A | 1x row-unmapped | The row-unmapped listing | None |
| B | 1x mapped (full row) | The mapped listing | None |
| C | 1x mapped + 1x row-unmapped | The mapped listing | The row-unmapped listing |
| D | 1x row-unmapped + 2x section-unmapped | Cheapest of the three | The other two |
| E | 2x mapped (2 tickets + 4 tickets) | Both (each owns its seats) | None |
