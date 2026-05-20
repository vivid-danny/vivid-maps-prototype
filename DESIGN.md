# VividSeats Seating Map — Design Reference

## Typography

**Primary font**: GT Walsheim (self-hosted, 4 weights: 400/500/700/900)
**Stack**: `'GT Walsheim', sans-serif`

Weights in use:
- 400 Regular — body copy, secondary labels
- 500 Medium — UI labels, headings, buttons
- 700 Bold — price display, strong emphasis
- 900 Black — reserved for hero-level numbers if needed

Type scale follows Tailwind defaults. Body line-length cap: 65ch.

## Color

### Brand palette (established)

| Role | Hex | Usage |
|---|---|---|
| Pink / primary | `#CE3197` | Section fill (branded theme), checkout button hover |
| Pink / CTA | `#D63384` | Primary action button |
| Pink CTA hover | `#C22575` | Button hover state |
| Pink CTA pressed | `#A91D63` | Button active state |
| Navy / dark | `#1a1a2e` | Pin default, deep backgrounds |
| Navy / pressed | `#0d0646` | Section pressed state |
| Purple / selected | `#312784` | Selected section/listing |
| Wine / hover | `#7A1D59` | Section hover |
| Deep wine | `#310C24` | Pin hover (branded theme) |
| Lavender-gray | `#EFEFF6` | Unavailable sections/seats |
| Slate | `#8B8FA3` | Available (zone/deal themes) |
| Foreground | `#030213` | Primary text |
| Background | `#ffffff` | App background |
| Surface | `#f9fafb` (gray-50) | Panel backgrounds |
| Border | `rgba(0,0,0,0.1)` | Dividers |

### Color strategy
**Restrained** — the Vivid pink is the single accent carrying ≤30% of the surface (map fills). All chrome is neutral. The map is the one place color signals meaning; UI panels defer to white/gray.

### Theme system
Three map themes, each recoloring section/row/seat fills:
- **branded**: pink fills (`#CE3197`), purple selection
- **zone**: tier-keyed colors (pink lower bowl, green club, blue upper)
- **deal**: dynamic color per deal score tier (red/orange/yellow/green)

UI chrome does not change between themes.

## Spacing & Layout

Tailwind default scale. Panel padding: 12–24px. Card padding: 12px top/bottom, 20px right, 12px left (asymmetric for list feel). Gap between cards: 8px.

## Motion

Established animation system in `src/styles/index.css`:
- Detail panel: slide-in 350ms cubic-bezier(0.215, 0.61, 0.355, 1)
- Pin hover: 200ms ease-out
- Pin selected: 300ms ease-out
- No bounce, no elastic curves

Principle: motion orients, it does not entertain. Transitions communicate state change.

## Component Patterns

### Listing card
White background, 1px border (`#e5e7eb`). Selected/hover state uses lightened brand color as background tint with full-opacity border. Price bold right-aligned. Location and ticket count left. Seat-view thumbnail left.

### Price pins
Pill shape with downward-pointing triangle. Scales relative to map zoom via CSS custom property `--pin-multiplier`. States: default (navy), hover (wine, +seat-view card), selected (white pill, shadow).

### Panels
`bg-gray-50` panel container. `bg-white` header strips. No shadows between sections — dividers only.

### Buttons
Primary: `bg-[#D63384]` rounded, full-width in checkout context. No outlines on default state.

## Iconography

Lucide React — `Minus`, `Plus`, `RotateCcw` confirmed in use. Keep icon usage minimal.

## Accessibility

WCAG AA as baseline aspiration (prototype phase). Pink on white requires care — use only for large elements (map fills, buttons) not small body text. Focus rings: Tailwind default `ring-2 ring-pink-500` (already in checkout select).
