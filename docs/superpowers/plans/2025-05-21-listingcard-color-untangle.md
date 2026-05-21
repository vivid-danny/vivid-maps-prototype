# ListingCard Color Untangle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dynamic `lightenColor`/`resolvedColor` system in ListingCard with explicit, independently-editable color constants for each interaction state.

**Architecture:** A single `CARD_COLORS` object at the top of `ListingCard.tsx` defines `bg` and `border` for each state (default, hover, pressed, selected). The `resolveInteractionState` function remains — only the color resolution changes. Color props are removed from the component interface and from `ListingsPanel`'s passthrough since nothing passes them anymore.

**Tech Stack:** React 18, TypeScript, existing `resolveInteractionState` utility.

---

## Impact Analysis

### What changes
- `src/app/components/ListingCard.tsx` — color resolution rewritten
- `src/app/components/ListingsPanel.tsx` — remove unused color props from interface/signature

### What does NOT change
- `resolveInteractionState` in `src/app/seatMap/behavior/visualState.ts` — still determines which state the card is in
- `src/app/components/Pin.tsx` — has its own separate color props fed from `seatColors`; completely independent
- `src/app/seatMap/maplibre/paintExpressions.ts` — map paint expressions use `seatColors` directly; unrelated
- `src/app/seatMap/maplibre/useMapPins.ts` — pin rendering uses `seatColors.pinHovered` etc.; unrelated
- `src/app/seatMap/config/defaults.ts` — `seatColors` still controls map visuals; no longer affects cards
- `lightenColor` in `src/app/seatMap/behavior/utils.ts` — stays exported (other code may use it in future); just removed from ListingCard's import

### Verification that nothing else passes color props
- `SeatMapRoot.tsx` (the only consumer of `ListingsPanel`) already had `selectedColor`, `hoverColor`, `pressedColor` removed in a prior change
- No other file imports or uses `ListingCard` directly
- `ListingsPanel` passes these through to `ListingCard` but receives `undefined` for all three since SeatMapRoot no longer provides them

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `src/app/components/ListingCard.tsx` | Modify | Remove color props, add `CARD_COLORS` constant, simplify style resolution |
| `src/app/components/ListingsPanel.tsx` | Modify | Remove `selectedColor`, `hoverColor`, `pressedColor` from interface and signature |

---

### Task 1: Rewrite ListingCard color system

**Files:**
- Modify: `src/app/components/ListingCard.tsx`

- [ ] **Step 1: Replace the color props and resolution logic**

Replace the entire file content of `src/app/components/ListingCard.tsx` with:

```typescript
import { memo, useState, type CSSProperties } from 'react';
import type { Listing } from '../seatMap/model/types';
import { useHoverIntent } from './useHoverIntent';
import { formatPrice, PERK_LABELS } from '../seatMap/behavior/utils';
import { resolveInteractionState } from '../seatMap/behavior/visualState';

const LISTING_CARD_PADDING = { top: 12, right: 20, bottom: 12, left: 12 };

const CARD_COLORS = {
  default:  { bg: 'oklch(99.5% 0.005 320)', border: 'oklch(91% 0.007 320)' },
  hover:    { bg: 'oklch(97% 0.01 320)',     border: 'oklch(85% 0.02 320)' },
  pressed:  { bg: 'oklch(95% 0.015 320)',    border: 'oklch(80% 0.025 320)' },
  selected: { bg: 'oklch(95% 0.02 280)',     border: 'oklch(75% 0.05 280)' },
};

interface ListingCardProps {
  listing: Listing;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (listing: Listing) => void;
  onHover: (listing: Listing | null) => void;
  disableHover?: boolean;
}

function ListingCardInner({ listing, isSelected, isHovered, onClick, onHover, disableHover = false }: ListingCardProps) {
  const hoverIntent = useHoverIntent<Listing | null>(disableHover ? undefined : onHover, null);
  const [localHover, setLocalHover] = useState(false);
  const [localPressed, setLocalPressed] = useState(false);
  const handleMouseEnter = () => {
    setLocalHover(true);
    hoverIntent.enter(listing);
  };

  const handleMouseLeave = () => {
    setLocalHover(false);
    setLocalPressed(false);
    hoverIntent.leave();
  };

  const cardBase = 'flex items-center justify-between rounded-md border cursor-pointer transition-colors ';
  let cardClass = cardBase;
  const paddingStyle = {
    paddingTop: LISTING_CARD_PADDING.top,
    paddingRight: LISTING_CARD_PADDING.right,
    paddingBottom: LISTING_CARD_PADDING.bottom,
    paddingLeft: LISTING_CARD_PADDING.left,
  };

  const state = resolveInteractionState({
    isAvailable: true,
    isSelected,
    isPressed: !disableHover && localPressed,
    isHovered: isHovered || (!disableHover && localHover),
  });
  const colors = state === 'available' ? CARD_COLORS.default : CARD_COLORS[state];
  const cardStyle: CSSProperties = {
    ...paddingStyle,
    backgroundColor: colors.bg,
    borderColor: colors.border,
  };

  const locationLabel = listing.rowNumber === null
    ? `Section ${listing.sectionLabel}`
    : `Section ${listing.sectionLabel}, Row ${listing.rowNumber}`;

  return (
    <div
      onClick={() => onClick(listing)}
      onMouseEnter={disableHover ? undefined : handleMouseEnter}
      onMouseLeave={disableHover ? undefined : handleMouseLeave}
      onMouseDown={disableHover ? undefined : () => setLocalPressed(true)}
      onMouseUp={disableHover ? undefined : () => setLocalPressed(false)}
      className={cardClass}
      style={cardStyle}
    >
      {/* Left side: Image + Section, Row, Tickets, Perks */}
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={listing.seatViewUrl}
          alt={`View from Section ${listing.sectionLabel}`}
          className="w-18 h-18 rounded-sm object-cover flex-shrink-0"
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-gray-900">
            {locationLabel}
          </span>
          <span className="text-sm text-gray-500">
            {listing.quantityAvailable} {listing.quantityAvailable === 1 ? 'ticket' : 'tickets'}
          </span>
          {(listing.dealScore >= 6 || listing.perks.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {listing.dealScore >= 6 && (
                <span
                  className="text-[12px] leading-tight px-1.5 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: 'oklch(92% 0.07 145)', color: 'oklch(35% 0.12 145)' }}
                >
                  {listing.dealScore.toFixed(1)}
                </span>
              )}
              {listing.perks.map((perk) => (
                <span
                  key={perk}
                  className="text-[12px] leading-tight px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'oklch(95% 0.008 320)', color: 'oklch(48% 0.015 320)' }}
                >
                  {PERK_LABELS[perk]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Price */}
      <div className="text-xl font-bold text-gray-900 shrink-0">
        {formatPrice(listing.price)} <span className="text-sm font-normal text-gray-500">ea.</span>
      </div>
    </div>
  );
}

export const ListingCard = memo(ListingCardInner);
```

Key differences from the current file:
- Removed `lightenColor` import (only `formatPrice` and `PERK_LABELS` remain from utils)
- Removed `selectedColor`, `hoverColor`, `pressedColor` from `ListingCardProps` and function signature
- Added `CARD_COLORS` constant with explicit `bg` and `border` for each state
- Replaced the `resolvedColor` + ternary + `lightenColor` block with a direct lookup: `CARD_COLORS[state]`
- Used `const` for `cardStyle` (no longer reassigned)

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds. TypeScript may warn about unused `lightenColor` export in utils — that's fine (it's still exported for potential future use).

- [ ] **Step 3: Verify tests pass**

Run: `npm run test`
Expected: All 43 tests pass.

---

### Task 2: Clean up ListingsPanel passthrough props

**Files:**
- Modify: `src/app/components/ListingsPanel.tsx`

- [ ] **Step 1: Remove color props from interface and signature**

In `src/app/components/ListingsPanel.tsx`, remove these three lines from the `ListingsPanelProps` interface:

```typescript
  selectedColor?: string;
  hoverColor?: string;
  pressedColor?: string;
```

And remove `selectedColor, hoverColor, pressedColor,` from the destructured function parameters.

Then remove these three prop passes from the `<ListingCard>` render (around line 182-184):

```typescript
                    selectedColor={selectedColor}
                    hoverColor={hoverColor}
                    pressedColor={pressedColor}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify tests pass**

Run: `npm run test`
Expected: All 43 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ListingCard.tsx src/app/components/ListingsPanel.tsx
git commit -m "refactor(listing-card): untangle colors into explicit CARD_COLORS constant"
```

---

## How to edit colors after this change

Open `src/app/components/ListingCard.tsx` and modify the `CARD_COLORS` object at the top:

```typescript
const CARD_COLORS = {
  default:  { bg: '...', border: '...' },
  hover:    { bg: '...', border: '...' },
  pressed:  { bg: '...', border: '...' },
  selected: { bg: '...', border: '...' },
};
```

Each state has independent `bg` and `border` values. No derived colors, no tinting functions, no coupling to map colors.

---

## Self-Review

**Spec coverage:**
- Explicit bg + border per state: covered by `CARD_COLORS`
- No `lightenColor`: removed from import and usage
- No coupling to map colors: color props removed from interface; SeatMapRoot already doesn't pass them
- Editable in one place: `CARD_COLORS` constant at top of file

**Placeholder scan:** None found. All code is complete.

**Type consistency:** `resolveInteractionState` returns `InteractionState` = `'available' | 'unavailable' | 'hover' | 'pressed' | 'selected'`. The card always passes `isAvailable: true` so `'unavailable'` never occurs. The lookup handles `'available'` → `CARD_COLORS.default`, and `'hover' | 'pressed' | 'selected'` → `CARD_COLORS[state]` directly (these are valid keys).

**Risk check:**
- `Pin.tsx` — completely unaffected; it has its own props fed from `seatColors` via `useMapPins`
- `paintExpressions.ts` — unaffected; uses `seatColors` for map layers
- `useMapPins.ts` — unaffected; renders pins with `seatColors.pinHovered` etc.
- `resolveInteractionState` — unchanged; still determines state priority
- Pole position hover — still works; `isHovered` prop still drives state to `'hover'`
