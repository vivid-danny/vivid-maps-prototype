# Seating Map Prototype

Current reference for the prototype's product behavior and implementation shape.

## Goal

Render a venue seating map that lets users:

- browse sections, rows, and seats
- filter listings through map selection
- inspect listing detail without losing map context
- compare inventory visually through theme-driven map rendering

## Rendering Model

The prototype uses MapLibre GL JS, not SVG DOM rendering.

Primary source types:

- sections GeoJSON
- rows GeoJSON
- seats GeoJSON
- seat connector GeoJSON generated at runtime
- section label point GeoJSON generated at runtime
- optional raster background / venue chrome assets

Pins are rendered as MapLibre `Marker` overlays with React content.

## Display Modes

| Mode | Visible geometry | Primary selectable unit |
|------|------------------|-------------------------|
| `sections` | section fills, outlines, labels | section |
| `rows` | section context plus row polygons | row |
| `seats` | rows, seat circles, listing connectors | listing / seat |

Layer visibility is controlled imperatively with `map.setLayoutProperty`.

## Selection Model

```ts
interface SelectionState {
  sectionId: string | null;
  rowId: string | null;
  listingId: string | null;
  seatIds: string[];
}
```

Rules:

- selecting a seat or listing also selects its row and section
- selecting a row also selects its section
- selecting a section does not select child rows or seats
- clicking the same selected item toggles back to `EMPTY_SELECTION`
- only one selection is active at a time

## View Modes

```ts
type ViewMode = 'listings' | 'detail';
```

- `listings`: map and listings panel are visible
- `detail`: ticket detail overlay is visible

The panel uses the existing `EMPTY_SELECTION` guard while detail is open so the background list does not collapse to a single listing.

## Availability Model

Sections, rows, and seats do not all use the same mechanism anymore.

Sections:

- unavailable state still uses MapLibre `feature-state`
- section hover and selection visuals are also feature-state / paint-expression driven

Rows and seats:

- unavailable state is encoded directly into the loaded detail GeoJSON via `properties.unavailable`
- row/seat styling and interaction read that property
- row/seat unavailable state is not synchronized through post-load `setFeatureState`

See [DETAIL_AVAILABILITY.md](./DETAIL_AVAILABILITY.md) for the full workflow.

## Inventory Refresh Rules

`MapLibreVenue` builds an `effectiveModel`.

- if no filtered listing inputs are provided, the effective model is the raw model
- if filtered listings are provided, the effective model uses those filtered listings for inventory-dependent behavior

Decorated row/seat detail sources refresh when:

- detail mode is first needed
- the current detail asset URLs change
- `effectiveModel.listings` changes

If a change should affect row or seat availability, it must be represented through `effectiveModel.listings`.

## Interaction Summary

Sections:

- unavailable sections cannot be hovered or selected
- section click selects the section

Rows:

- unavailable rows render unavailable immediately from source properties
- clicking an unavailable row falls back to selecting the parent section when that section has inventory
- row muting is paint-expression driven, not `parentMuted` feature-state driven

Seats:

- unavailable seats cannot be hovered or selected
- seat hover and connector hover operate at listing scope
- seat and connector muting is filter-driven outside the selected section

## Theming

Supported themes:

- `branded`
- `zone`
- `deal`

Sections, rows, seats, connectors, and overlays should preserve the established visual semantics for each theme. Any availability refactor should change data sourcing only, not theme behavior.

## Pin System

Pins represent listing prices and are density-limited by display mode.

- sections mode: section-level pricing
- rows mode: row-level pricing
- seats mode: listing-level pricing

Pins are suppressed or replaced when selection or hover overlays would otherwise conflict visually.

## Key Implementation Files

- [src/app/components/MapLibreVenue.tsx](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/components/MapLibreVenue.tsx)
- [src/app/seatMap/components/SeatMapRoot.tsx](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/components/SeatMapRoot.tsx)
- [src/app/seatMap/maplibre/createStyle.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/createStyle.ts)
- [src/app/seatMap/maplibre/useMapInteractions.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/useMapInteractions.ts)
- [src/app/seatMap/maplibre/useMapSelectionSync.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/useMapSelectionSync.ts)
- [src/app/seatMap/maplibre/useFeatureState.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/useFeatureState.ts)
- [src/app/seatMap/maplibre/loadDecoratedDetailGeoJson.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/loadDecoratedDetailGeoJson.ts)

## Notes

- `INTERACTION.md` is the visual and interaction reference.
- `DETAIL_AVAILABILITY.md` is the inventory-specific implementation note.
- Older SVG-era assumptions should be treated as obsolete.
