# Zone Inventory

Rules for events where some sellers list only a **zone** — a named group of
sections — and no section at all. Selecting a section on the map must never hide
that zone-only inventory. One map, no section/zone toggle: the listing panel
does the work.

Prototype route: `/zones` (or `?prototype=zones`). Source: `src/app/zoneInventory/`.

## The visibility rule

With one or more sections selected, every listing lands in a tier:

| Listing's section | Listing's zone | Visibility |
|---|---|---|
| A selected section | Zone of a selected section | Tier 1 |
| Not listed | Zone of a selected section | Tier 2 |
| A section not selected | Zone of a selected section | Tier 2 |
| Anything | No selected section is in this zone | Hidden |
| Can't be matched to a zone | — | Hidden, always |

- **No selection**: every zone-matched listing, one flat list, no tiers.
- **Multi-select in one zone**: all selected sections are Tier 1; the rest of
  that zone is Tier 2.
- **Multi-select across zones**: selected sections are Tier 1; the remainder of
  every touched zone merges into one Tier 2 group.

A listing with no matched zone is dropped before anything else happens. A bare
`"AU4"` is the canonical case: AU4 is split between Shortside Upper and VIP, so
the string names no single zone and the listing is unplaceable.

Implemented in `logic/visibility.ts`, specified by `logic/visibility.test.ts`.

## Listing panel

| Element | Copy |
|---|---|
| Results header | `58 listings · 3 in Section 119` |
| Group 1 header | none — the results header already names and counts the selection |
| Group 2 header | `55 listings in Longside Lower Central` / `80 listings in these zones` |
| Empty Tier 1 | `No listings in Section 119`, followed by Group 2 |

Headers follow the base prototype's pattern: the listing count is bold, the
remainder is `font-normal text-ink-secondary`.

Quantity and price-range filters apply to both groups. Tier 1 being empty is
never a dead end while the zone has inventory.

### Sort

Lowest Price or Deal Score, in the base prototype's header control. Sort runs
**inside** each tier and never across them: the tier split is a relevance
statement — the section the buyer picked comes first — so letting a sort
interleave the groups would bury that section's own inventory beneath the zone's.
Equal deal scores fall back to price. Sorting never changes a pin, which always
reports its section's lowest price.

## Listing card

- Title is the section number, or `Section not listed` when the seller gave none.
- The zone name appears on every card — it is the only location a zone-only
  listing has, and the disambiguator in a multi-zone Group 2.
- Rows are unreliable: `***`, `N/A`, `TBC`, `TBD` and blanks are hidden
  (`displayRow`). Most listings have no seats. The card never depends on either.
- Quantity and price always show. A deal score of 6.0 or higher is badged, as in
  the base prototype's listing card.

## Map

- A section's price pin shows the lowest price among listings with that exact
  section, and nothing else. Styling is taken from the base prototype's `Pin`,
  measured from the running app: `#1a1a2e`/white 10px bold pill, 4px radius, 4px
  padding, downward tail; hover `#2A2E31` at 1.8x; **selected white with black
  text** at 1.8x with a drop shadow. Out-of-zone pins recede on opacity alone —
  the base has no muted pin, and white is already the selected treatment.
  Zone-only listings have no section, so they never price a pin. The section
  number renders on the map just below the pin.
- A section with zero exact listings has no pin but stays selectable (121, VIP2).
- On selection the selected sections keep the full brand pink under a strong
  purple outline; the rest of each touched zone keeps a lighter pink; everything
  outside those zones recedes under a near-white veil.
- Zones are non-contiguous by design — Longside Lower Central spans two opposite
  stands, VIP spans two corner boxes and half of AU4. The tint covers the whole
  zone and **the map never auto-zooms**, because moving the view would hide the
  far half of Group 2.
- No zone legend, no zone chips, no toggle.
- Map chrome matches the base prototype: `plus`/`minus` icon buttons, and a
  `RotateCcw` reset that stays hidden until the buyer pans, zooms, or selects.

## Mock venue

A schematic football stadium: a rectangular pitch ringed by four stands, 24
drawn shapes across 5 zones (`data/venue.ts`).

| Zone | Sections |
|---|---|
| Longside Lower Central | 103, 104, 105 (south) · 119, 120, 121, 122 (north) |
| Longside Upper Central | 203, 204, 205 · 219, 220, 221 |
| Shortside Lower | AL1, AL2 (west) · AL3, AL4 (east) |
| Shortside Upper | AU1, AU2 · AU3, AU4 |
| VIP | VIP1, VIP2 (corner boxes) · AU4 |

AU4 is one section split between two zones, drawn as two shapes
(`AU4-SU`, `AU4-VIP`) that share the section label `AU4`.

80 listings, $167–$2,596, deal scores 3.0–9.6 with roughly a third badged
(`data/listings.ts`): 48 with an exact section, 24 zone-only, 8 matching no zone. Section 119 has 9 exact listings, 122 has 2, and
121 and VIP2 have none.

## Demo states

The state switcher above the map jumps to each: no selection · busy section
(119) · thin section (122) · empty section (121) · two sections in one zone ·
two sections across zones · the VIP half of split section AU4. A width toggle
renders the mobile layout at 390px.
