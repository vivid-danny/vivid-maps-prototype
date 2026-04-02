# Map Visual States — Zone Theme

Specification for section and row-level visual states in the zone color theme. All overlays are composited on top of the base fill color using dedicated MapLibre fill/line layers.

A key architectural pattern is **cross-level muting**: when a selection exists at one level, features at child levels outside that selection are also muted. This is implemented via a `parentMuted` feature-state rather than relying on parent overlay layers (which render below child layers in the z-stack).

---

# Sections

## Layer Stack (bottom to top)

| Order | Layer ID                    | Type | Driven by        | Visibility               |
|-------|-----------------------------|------|------------------|--------------------------|
| 1     | `section-base`              | fill | static           | Always visible           |
| 2     | `section`                   | fill | feature-state    | Sections mode only (opacity 0 in rows/seats) |
| 3     | `section-hover-overlay`     | fill | feature-state    | Sections mode only       |
| 4     | `section-selected-overlay`  | fill | paint expression  | Sections mode, when selection active |
| 5     | `section-outline`           | line | static           | Always visible           |
| 6     | `section-selected-outline`  | line | filter           | When section selected    |
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

Border between all sections. Always visible; opacity varies by display mode.

| Property | Value                                                  |
|----------|--------------------------------------------------------|
| Color    | `#d3d3dc`                                              |
| Width    | `1px`                                                  |
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
| Selected Outline | `rgba(4, 9, 44, 0.75)`      | 2px border around selected section   |

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
| Selected         | Zone color + selected overlay (`rgba(4, 9, 44, 0.1)`) + selected outline (2px, `rgba(4, 9, 44, 0.75)`) |
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

Any section, row, or seat that has no listing data (inventory) is marked as unavailable. A section is considered unavailable if it has **zero listings** (not just zero available seats). Unavailable features:

- Rendered with `#EFEFF6` fill (matches section-base), visually appearing as empty/inactive
- **Cannot be interacted with** — they do not trigger hover, selection, or any other state changes
- Cursor does not change to `pointer` on mouseover
- Click events are ignored (checked via `feature-state.unavailable` guard) at all display modes
- Filtered out of interactive layers using the `seatableIds` array from the venue manifest
- **No child detail rendered**: sections with no inventory do not render row outlines, row fills, seat circles, or row labels when zoomed in — only the section outline and section label remain visible

This applies at all zoom levels: unavailable sections in sections mode, unavailable rows in rows mode, and unavailable seats in seats mode.

## Implementation Details

### section-hover-overlay

Feature-state driven fill layer. Visibility toggled by display mode (visible in sections mode, hidden in rows/seats).

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0.5)',
  'rgba(4, 9, 44, 0)'  // transparent when not hovered
]
```

### section-selected-overlay

Active only in sections mode. Hidden by default. When a section is selected, visibility is set to `visible` and the paint expression is updated via `setPaintProperty`:

```js
'fill-color': [
  'case',
  ['==', ['get', 'id'], <selectedSectionId>], 'rgba(4, 9, 44, 0.1)',    // selected tint
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0)',  // unmute on hover
  'rgba(255, 255, 255, 0.65)'                                             // muted
]
```

The `hovered` feature-state check removes the white wash on hover so the darken overlay composites against the original zone color.

In rows/seats mode, section-level muting is NOT handled by this layer (it renders below row layers). Instead, cross-level muting is handled by `parentMuted` feature-state on the `row-selected-overlay` — see the Cross-Level Muting section below.

### section-selected-outline

Filter-driven visibility. When a section is selected, the filter is updated to match that section's ID. Visible across all zoom levels.

```js
filter: ['==', ['get', 'id'], <selectedSectionId>]
line-color: 'rgba(4, 9, 44, 0.75)'
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

| Order | Layer ID                  | Type | Driven by       | Visibility              |
|-------|---------------------------|------|-----------------|-------------------------|
| 1     | `row`                     | fill | paint expression | Rows + seats modes     |
| 2     | `row-hover-overlay`       | fill | feature-state    | Rows + seats modes     |
| 3     | `row-selected-overlay`    | fill | feature-state    | Rows + seats modes (always visible, paint controls effect) |
| 4     | `row-selected-outline`    | line | feature-state    | Rows + seats modes     |
| 5     | `row-outline`             | line | feature-state    | Rows + seats modes     |
| 6     | `row-label`               | symbol | static         | Rows + seats modes     |

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
| Same section     | Fill color + muted overlay (`rgba(255, 255, 255, 0.65)`)   |
| Other sections   | Fill color + muted overlay (`rgba(255, 255, 255, 0.65)`)   |

All non-selected rows across the entire venue are muted, not just siblings in the same section.

### Selected + Hovering a non-selected row (same section)

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Unchanged (selected tint + outline)                         |
| Hovered          | Muted overlay **removed** (transparent) + hover darken applied (`rgba(4, 9, 44, 0.5)`). Appears as original fill color darkened. |
| All others       | Remain muted (`rgba(255, 255, 255, 0.65)`)                 |

### Selected + Hovering a row in a different section

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Unchanged (selected tint + outline)                         |
| Hovered section  | All rows in the hovered section **unmute** temporarily. The hovered row gets the darken overlay. |
| All others       | Remain muted                                                |

This "hover-reveal" unmutes the entire section's rows when hovering any row in a non-selected section, so the user can see the zone colors and gauge available inventory.

### Selected + Hovering the selected row

| Row              | Visual                                                      |
|------------------|-------------------------------------------------------------|
| Selected         | Selected tint + hover darken both composite on fill color   |
| All others       | Remain muted                                                |

### Unavailable (no inventory)

Same visual rules as sections — rows without any available seats are rendered with `#EFEFF6` and do not trigger hover state changes.

**Click behavior differs from sections:** clicking an unavailable row **selects the parent section** rather than being ignored — but only if the parent section itself has inventory. If the parent section is also unavailable, the click is ignored. This triggers cross-level muting — all rows outside the selected section are muted, allowing the user to see which section they've focused on. The same rule will apply to unavailable seats (selecting the parent row).

## Implementation Details

### row-hover-overlay

Feature-state driven fill layer. Hidden by default; visible in rows + seats modes.

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0.5)',
  'rgba(4, 9, 44, 0)'  // transparent when not hovered
]
```

### row-selected-overlay

Always visible in rows + seats modes. Uses a 4-state priority chain via feature-state:

```js
'fill-color': [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(4, 9, 44, 0.1)',     // selected tint
  ['boolean', ['feature-state', 'hovered'], false], 'rgba(4, 9, 44, 0)',         // unmute on hover
  ['boolean', ['feature-state', 'parentMuted'], false], 'rgba(255, 255, 255, 0.65)', // muted
  'rgba(4, 9, 44, 0)'                                                            // no effect
]
```

The transparent fallback (`rgba(4, 9, 44, 0)`) means the layer has no visual effect when no feature-state is set, making it safe to leave always-visible.

### row-selected-outline

Feature-state driven. Only renders on the selected row; transparent elsewhere.

```js
'line-color': [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 'rgba(4, 9, 44, 0.2)',
  'rgba(4, 9, 44, 0)'
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
  ['boolean', ['feature-state', 'selected'], false], 'rgba(4, 9, 44, 0)',
  '#E3E3E8'
]
line-width: 0.5
line-cap: round
line-join: round
```

---

# Cross-Level Muting

When a selection exists at one zoom level, child features at deeper levels outside that selection must also appear muted. This cannot be handled by parent overlay layers because MapLibre renders child layers (rows) above parent overlays (section-selected-overlay) in the z-stack.

## Mechanism: `parentMuted` feature-state

Instead of relying on parent overlays, the system sets a `parentMuted` feature-state directly on child features. The child's own overlay layer (which renders at the correct z-level) reads this state and applies the muted color.

### When `parentMuted` is set on rows

| Selection State                  | Muted Rows                                       |
|----------------------------------|--------------------------------------------------|
| Section selected (no row)        | All rows outside the selected section             |
| Row selected                     | All rows except the selected row (entire venue)   |
| No selection                     | None                                              |

### Hover-reveal

When hovering a non-selected section that has muted rows, `parentMuted` is temporarily cleared on all rows in that section. This lets the user preview the section's zone colors before clicking. On hover-leave, `parentMuted` is restored.

For same-section row hover (hovering a sibling row within the selected section), the paint expression handles unmuting directly — `hovered` has higher priority than `parentMuted` in the expression, so no feature-state manipulation is needed.

### Priority chain

The `row-selected-overlay` paint expression evaluates feature-states in this order:

1. `selected` → selected tint (highest priority)
2. `hovered` → transparent (unmute)
3. `parentMuted` → muted white wash
4. fallback → transparent (no effect)

This ensures that a row can be simultaneously `parentMuted` and `hovered`, and the hover wins.

### Extending to seats

The same pattern applies at the seat level. When a row is selected in seats mode:
- Set `parentMuted: true` on all seat features not in the selected row
- The `seat-selected-overlay` paint expression gets the same 4-state priority chain
- Hover-reveal: hovering a muted row temporarily unmutes its seats

---

# Zoom Behavior

Selection triggers camera navigation to bring the selected feature into view. The zoom target depends on the selection level.

## Zoom Targets

| Selection Type          | Zoom Target                                              |
|-------------------------|----------------------------------------------------------|
| Section (from overview) | `ROW_ZOOM_MIN + 2` (16) — zooms into the section        |
| Section (already zoomed)| `max(ROW_ZOOM_MIN + 2, currentZoom)` — pans without zooming out |
| Row                     | `SEAT_ZOOM_MIN` (16) — centers on the row                |
| Listing (from panel)    | `SEAT_ZOOM_MIN` (16) — centers on the row                |

When selecting a section while already zoomed past the base zoom, the camera **pans to the section center without zooming out**. This prevents jarring zoom-out when clicking between sections in rows mode.

## Auto-Zoom Disabled

When the initial display and zoomed-in display are configured to the same value (e.g., both set to "sections"), **all auto-zoom on selection is disabled**. Since there is no deeper level of detail to zoom into, the user controls pan and zoom manually. Selection still works — overlays, muting, and the listings panel all respond — but the camera does not move.
