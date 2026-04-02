# Map Visual States — Zone Theme

Specification for section and row-level visual states in the zone color theme. All overlays are composited on top of the base fill color using dedicated MapLibre fill/line layers.

---

# Sections

## Layer Stack (bottom to top)

| Order | Layer ID                    | Type | Driven by        | Visibility               |
|-------|-----------------------------|------|------------------|--------------------------|
| 1     | `section-base`              | fill | static           | Always visible           |
| 2     | `section`                   | fill | feature-state    | Always visible           |
| 3     | `section-hover-overlay`     | fill | feature-state    | Sections mode only       |
| 4     | `section-selected-overlay`  | fill | paint expression  | When selection active    |
| 5     | `section-outline`           | line | static           | Always visible           |
| 6     | `section-selected-outline`  | line | filter           | When selection active    |
| 7     | `section-label`             | symbol | static         | Always visible           |

## Base Layers

### section-base

Neutral fill under all sections. Shows through when a section has no zone color or no inventory.

| Property   | Value     |
|------------|-----------|
| Fill color | `#EFEFF6` |
| Opacity    | `1`       |

### section (zone fill)

Per-section zone color derived from the zone assignment. Does **not** change on hover in zone theme — only the overlay layer handles hover darkening.

| Zone     | Color     |
|----------|-----------|
| Tier 1   | `#D45196` |
| Tier 2   | `#30C096` |
| Tier 3   | `#4C85D0` |
| Alt      | `#B99872` |

Unavailable sections use `#EFEFF6` (matches section-base).

### section-outline

Thin border between all sections. Always visible; opacity varies by display mode.

| Property | Value                                                  |
|----------|--------------------------------------------------------|
| Color    | `#d3d3dc`                                              |
| Width    | `0.5px`                                                |
| Opacity  | `0.3` in sections mode, `1.0` in rows/seats mode      |

### section-label

Section ID text rendered above all other layers.

| Property | Value                                                  |
|----------|--------------------------------------------------------|
| Color    | `#04092C`                                              |
| Font     | GTWalsh Bold                                           |
| Size     | Interpolated: `12px` at zoom 13, `28px` at zoom 18    |
| Opacity  | `1.0` in sections mode, `0.3` in rows/seats mode      |

## Overlay Values

| Name             | Color                        | Purpose                              |
|------------------|------------------------------|--------------------------------------|
| Hover            | `rgba(4, 9, 44, 0.5)`       | Darken tint on hovered section       |
| Muted            | `rgba(255, 255, 255, 0.65)`  | White wash on non-selected sections  |
| Selected         | `rgba(4, 9, 44, 0.1)`       | Dark tint on the selected section    |
| Selected Outline | `rgba(4, 9, 44, 0.2)`       | 2px border around selected section   |

## Interaction States

### Default (no hover, no selection)

All sections display their zone color at full opacity. No overlays active. Section outlines visible at `0.3` opacity.

### Hover (no selection)

| Section          | Visual                                                        |
|------------------|---------------------------------------------------------------|
| Hovered          | Zone color + hover overlay (`rgba(4, 9, 44, 0.5)`)           |
| All others       | Zone color, unchanged                                         |

The base zone fill does **not** change on hover. Only the `section-hover-overlay` layer composites a darken tint. Cursor changes to `pointer`.

### Selected (no hover)

| Section          | Visual                                                        |
|------------------|---------------------------------------------------------------|
| Selected         | Zone color + selected overlay (`rgba(4, 9, 44, 0.1)`) + selected outline (2px, `rgba(4, 9, 44, 0.2)`) |
| All others       | Zone color + muted overlay (`rgba(255, 255, 255, 0.65)`)     |

### Selected + Hovering a non-selected section

| Section          | Visual                                                        |
|------------------|---------------------------------------------------------------|
| Selected         | Unchanged (selected tint + outline)                           |
| Hovered          | Muted overlay **removed** (transparent) + hover darken applied (`rgba(4, 9, 44, 0.5)`). Appears as original zone color darkened. |
| All others       | Remain muted (`rgba(255, 255, 255, 0.65)`)                   |

### Selected + Hovering the selected section

| Section          | Visual                                                        |
|------------------|---------------------------------------------------------------|
| Selected         | Selected tint + hover darken both composite on zone color     |
| All others       | Remain muted                                                  |

### Unavailable (no inventory)

Any section, row, or seat that has no listing data (inventory) is marked as unavailable. Unavailable features:

- Rendered with `#EFEFF6` fill (matches section-base), visually appearing as empty/inactive
- **Cannot be interacted with** — they do not trigger hover, selection, or any other state changes
- Cursor does not change to `pointer` on mouseover
- Click events are ignored (checked via `feature-state.unavailable` guard)
- Filtered out of interactive layers using the `seatableIds` array from the venue manifest

This applies at all zoom levels: unavailable sections in sections mode, unavailable rows in rows mode, and unavailable seats in seats mode.

## Implementation Details

### section-hover-overlay

Feature-state driven fill layer. Visibility toggled by display mode (visible in sections mode, hidden in rows/seats).

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0.5)',
  'rgba(0, 0, 0, 0)'  // transparent when not hovered
]
```

### section-selected-overlay

Hidden by default. When a section is selected, visibility is set to `visible` and the paint expression is updated via `setPaintProperty`:

```js
'fill-color': [
  'case',
  ['==', ['get', 'id'], <selectedSectionId>], 'rgba(4, 9, 44, 0.1)',    // selected tint
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(0, 0, 0, 0)',  // unmute on hover
  'rgba(255, 255, 255, 0.65)'                                            // muted
]
```

The `hovered` feature-state check removes the white wash on hover so the darken overlay composites against the original zone color.

### section-selected-outline

Filter-driven visibility. When a section is selected, the filter is updated to match that section's ID:

```js
filter: ['==', ['get', 'id'], <selectedSectionId>]
line-color: 'rgba(4, 9, 44, 0.2)'
line-width: 2
```

### Unavailable feature-state

Unavailable status is set via feature-state on the base fill layer. Interaction handlers check this state and bail out early.

```js
// section fill expression
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'unavailable'], false], '#EFEFF6',
  <zone color>
]
```

```js
// interaction handler guard (applied to click and hover handlers)
if (state?.unavailable) return;
```

---

# Rows

Rows become visible when the user zooms into a section (rows + seats display modes). Each row inherits its parent section's zone color in rows mode, or switches to a white fill in seats mode.

## Layer Stack (bottom to top)

| Order | Layer ID                  | Type | Driven by       | Visibility                  |
|-------|---------------------------|------|-----------------|--------------------------|
| 1     | `row`                     | fill | paint expression | Rows + seats modes         |
| 2     | `row-hover-overlay`       | fill | feature-state    | Rows + seats modes         |
| 3     | `row-selected-overlay`    | fill | feature-state    | When row selection active  |
| 4     | `row-selected-outline`    | line | feature-state    | Rows + seats modes         |
| 5     | `row-outline`             | line | feature-state    | Rows + seats modes         |
| 6     | `row-label`               | symbol | static         | Rows + seats modes         |

## Base Layers

### row (fill)

Row fill color changes by display mode:

| Display Mode | Fill Color                                             |
|--------------|--------------------------------------------------------|
| Rows         | Inherits parent section's zone color                   |
| Seats        | `#FFFFFF` (white, so seat circles stand out)           |

Unavailable rows use `#EFEFF6` (same as section-base).

### row-outline

Thin border between rows within a section. Hidden on a selected row so the stroke doesn't darken against the overlay tint.

| Property | Value                                                        |
|----------|--------------------------------------------------------------|
| Color    | `#E3E3E8` (transparent on selected row)                      |
| Width    | `0.5px`                                                      |
| Cap/Join | Round                                                        |

### row-label

Row ID text, visible in rows and seats modes.

| Property | Value                                                  |
|----------|--------------------------------------------------------|
| Color    | `#04092C`                                              |
| Font     | GTWalsh Bold                                           |
| Size     | Interpolated: `4px` at zoom 14, `16px` at zoom 18     |

## Overlay Values

| Name             | Color                        | Purpose                            |
|------------------|------------------------------|------------------------------------|
| Hover            | `rgba(4, 9, 44, 0.5)`       | Darken tint on hovered row         |
| Muted            | `rgba(255, 255, 255, 0.65)`  | White wash on non-selected rows    |
| Selected         | `rgba(4, 9, 44, 0.1)`       | Dark tint on the selected row      |
| Selected Outline | `rgba(4, 9, 44, 0.2)`       | 1.5px border around selected row   |

## Interaction States

### Default (no hover, no selection)

All rows display their fill color (zone color in rows mode, white in seats mode). No overlays active. Row outlines visible between rows.

### Hover (no selection)

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Hovered          | Fill color + hover overlay (`rgba(4, 9, 44, 0.5)`)         |
| All others       | Fill color, unchanged                                       |

The base row fill does **not** change on hover. Only the `row-hover-overlay` layer composites a darken tint. Cursor changes to `pointer`.

### Selected (no hover)

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Fill color + selected overlay (`rgba(4, 9, 44, 0.1)`) + selected outline (1.5px, `rgba(4, 9, 44, 0.2)`). Row outline hidden. |
| All others       | Fill color + muted overlay (`rgba(255, 255, 255, 0.65)`)   |

### Selected + Hovering a non-selected row

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Unchanged (selected tint + outline)                         |
| Hovered          | Muted overlay **removed** (transparent) + hover darken applied (`rgba(4, 9, 44, 0.5)`). Appears as original fill color darkened. |
| All others       | Remain muted (`rgba(255, 255, 255, 0.65)`)                 |

### Selected + Hovering the selected row

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Selected tint + hover darken both composite on fill color   |
| All others       | Remain muted                                                |

### Unavailable (no inventory)

Same visual rules as sections — rows without any available seats are rendered with `#EFEFF6` and do not trigger hover state changes.

**Click behavior differs from sections:** clicking an unavailable row **selects the parent section** rather than being ignored. This allows users to still navigate from an unavailable row back to a section-level selection. The same rule will apply to unavailable seats.

## Implementation Details

### row-hover-overlay

Feature-state driven fill layer. Hidden by default; visible in rows + seats modes.

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0.5)',
  'rgba(0, 0, 0, 0)'  // transparent when not hovered
]
```

### row-selected-overlay

Hidden by default. Shown when a row is selected (rows + seats modes). Uses feature-state for both selection and hover-unmute:

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(4, 9, 44, 0.1)',    // selected tint
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(0, 0, 0, 0)',         // unmute on hover
  'rgba(255, 255, 255, 0.65)'                                                   // muted
]
```

### row-selected-outline

Feature-state driven. Only renders on the selected row; transparent elsewhere.

```js
'line-color': [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(4, 9, 44, 0.2)',
  'rgba(0, 0, 0, 0)'
]
line-width: 1.5
line-cap: round
line-join: round
```

### row-outline

Visible on all rows except the selected row (hidden to avoid darkening against the overlay tint).

```js
'line-color': [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(0, 0, 0, 0)',
  '#E3E3E8'
]
line-width: 0.5
line-cap: round
line-join: round
```
