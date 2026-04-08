# Detail Availability Workflow

This note documents how row and seat availability works in the MapLibre prototype after the detail-source availability refactor.

## Why This Exists

The prototype previously wrote row and seat `unavailable` state through MapLibre `feature-state` after detail sources loaded. That created a visible correction window and unnecessary sync work on the main thread.

The current workflow keeps the performance gains by moving row and seat availability into the loaded detail GeoJSON itself.

## Current Source Of Truth

For detail geometry:

- Rows and seats derive availability from the effective model's listings.
- The decorated GeoJSON features carry `properties.unavailable: boolean`.
- Row and seat rendering and interaction read that property directly.

For sections:

- Section unavailable state still uses MapLibre `feature-state`.
- This was intentionally left in place because the performance issue was in row/seat sync, not section sync.

## Effective Inventory Model

`MapLibreVenue` builds an `effectiveModel`.

- If no filtered inventory is active, `effectiveModel` is the raw `model`.
- If filtered inventory is active, `effectiveModel.listings` and related section maps are derived from the filtered listing inputs.

Important rule:

- If a change should affect row or seat availability, it must be reflected in `effectiveModel.listings`.

If inventory changes through some other side channel, the decorated detail sources will not pick it up automatically.

## Decoration Flow

The shared loader module is:

- [src/app/seatMap/maplibre/loadDecoratedDetailGeoJson.ts](/Users/daniel.lopez/vividseats/vivid-maps-prototype/src/app/seatMap/maplibre/loadDecoratedDetailGeoJson.ts)

It exports:

- `loadDecoratedRowsGeoJson(rowsUrl, model)`
- `loadDecoratedSeatsGeoJson(seatsUrl, model)`

Each function:

1. fetches the raw GeoJSON
2. clones the `FeatureCollection`
3. writes `properties.unavailable`

Rules:

- Row `unavailable: true` when no listing exists for that row in the effective model
- Seat `unavailable: true` when that seat does not appear in any listing in the effective model

## Refresh Triggers

Detail sources refresh when:

- the map first leaves `sections` mode and detail geometry is needed
- the current detail asset URLs change
- `effectiveModel.listings` changes after detail has been loaded

Detail sources do not refresh for unrelated changes such as:

- selection
- hover
- pins-only updates
- theme/color changes
- metadata changes that do not affect listings

This is intentional. Availability is listing-driven.

## Styling Boundaries

The intended behavior is:

- keep original row, seat, connector, overlay, and theme semantics
- change only how row/seat unavailable is sourced

That means:

- do not reintroduce row/seat unavailable `feature-state`
- do not broaden style-expression changes unless required
- if a style expression changes, preserve the original visual outcome and only swap the unavailable predicate from `feature-state` to `['get', 'unavailable']`

## Interaction Boundaries

Row and seat interactions should treat `properties.unavailable === true` as unavailable.

Section interactions still read section unavailable from `feature-state`.

## What To Update If Inventory Rules Expand

If future inventory logic is more complex than listings alone, there are only two valid ways to extend this system:

1. map the new inventory source into `effectiveModel.listings`
2. expand the decoration helpers so they explicitly include that new inventory source when computing `properties.unavailable`

Do not patch row/seat availability through post-load `setFeatureState` writes unless the performance tradeoff is re-evaluated intentionally.
