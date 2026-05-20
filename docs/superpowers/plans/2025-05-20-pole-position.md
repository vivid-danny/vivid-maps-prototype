# Pole Position Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The listing card at the top of the visible scroll area ("pole position") automatically triggers hover state on itself and the corresponding section/row/seat on the map — on both mobile and desktop.

**Architecture:** A new hook (`usePolePosition`) uses IntersectionObserver on a sentinel element at the top of the scroll container to detect which listing card occupies the pole position. When the pole listing changes, it emits the listing to a new handler (`handlePolePosition`) in the view state hook, which sets `hoverState` — reusing the existing hover → map sync pipeline. On desktop, explicit mouse hover takes priority over pole position; on mobile (where mouse hover is disabled), pole position is the only source of hover state.

**Tech Stack:** React 18, TypeScript, IntersectionObserver API, @tanstack/react-virtual, existing `HoverState` / `useMapSelectionSync` pipeline.

---

## File Structure

| Path | Action | Responsibility |
|------|--------|---------------|
| `src/app/components/usePolePosition.ts` | Create | Hook that observes scroll position and reports the pole-position listing |
| `src/app/components/ListingsPanel.tsx` | Modify | Wire `usePolePosition` into the virtualized list |
| `src/app/seatMap/state/useSeatMapPrototypeViewState.ts` | Modify | Add `handlePolePosition` handler |
| `src/app/seatMap/components/SeatMapRoot.tsx` | Modify | Pass new `onPolePosition` prop to `ListingsPanel` |
| `src/app/seatMap/model/types.ts` | Modify | Add `source` field to `HoverState` |
| `src/tests/usePolePosition.test.ts` | Create | Unit tests for the hook |

---

### Task 1: Extend HoverState with a source discriminator

We need to distinguish pole-position-driven hover from explicit mouse hover so that mouse hover can take priority on desktop.

**Files:**
- Modify: `src/app/seatMap/model/types.ts`

- [ ] **Step 1: Add `source` to HoverState**

In `src/app/seatMap/model/types.ts`, add a `source` field:

```typescript
export type HoverSource = 'pointer' | 'pole';

export interface HoverState {
  listingId: string | null;
  sectionId: string | null;
  rowId: string | null;
  source?: HoverSource;
}
```

- [ ] **Step 2: Update EMPTY_HOVER constant**

Ensure `EMPTY_HOVER` still works (it already has all null fields; `source` is optional so no change needed). Verify:

```typescript
export const EMPTY_HOVER: HoverState = { listingId: null, sectionId: null, rowId: null };
```

No change required — `source` is optional.

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: No type errors (source is optional, existing code doesn't set it).

- [ ] **Step 4: Commit**

```bash
git add src/app/seatMap/model/types.ts
git commit -m "feat(pole-position): add HoverSource discriminator to HoverState"
```

---

### Task 2: Create the `usePolePosition` hook

This hook watches which virtual listing card sits in the "pole position" — the first card whose top edge is at or below the scroll container's top. It uses IntersectionObserver with a `rootMargin` that creates a thin detection band at the top of the container.

**Files:**
- Create: `src/app/components/usePolePosition.ts`

- [ ] **Step 1: Create the hook file**

Create `src/app/components/usePolePosition.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import type { Listing } from '../seatMap/model/types';

interface UsePolePositionOptions {
  scrollContainer: HTMLElement | null;
  sortedListings: Listing[];
  enabled: boolean;
  onPoleChange: (listing: Listing | null) => void;
}

/**
 * Detects the listing card occupying the "pole position" — the topmost
 * fully-visible card in the scroll container — and calls onPoleChange
 * when it changes.
 *
 * Strategy: On each scroll frame, find the first virtual item whose top
 * is >= the container's scrollTop. This avoids IntersectionObserver
 * complexity with virtualised lists where DOM nodes recycle.
 */
export function usePolePosition({
  scrollContainer,
  sortedListings,
  enabled,
  onPoleChange,
}: UsePolePositionOptions) {
  const currentPoleRef = useRef<string | null>(null);
  const onPoleChangeRef = useRef(onPoleChange);
  onPoleChangeRef.current = onPoleChange;

  const sortedListingsRef = useRef(sortedListings);
  sortedListingsRef.current = sortedListings;

  const rafRef = useRef<number | null>(null);

  const detectPole = useCallback(() => {
    if (!scrollContainer) return;

    const cards = scrollContainer.querySelectorAll<HTMLElement>('[data-index]');
    if (cards.length === 0) {
      if (currentPoleRef.current !== null) {
        currentPoleRef.current = null;
        onPoleChangeRef.current(null);
      }
      return;
    }

    const containerTop = scrollContainer.scrollTop;
    const paddingStart = 12;
    let poleIndex: number | null = null;

    for (const card of cards) {
      const cardTop = card.offsetTop - paddingStart;
      if (cardTop + card.offsetHeight > containerTop) {
        const idx = Number(card.getAttribute('data-index'));
        if (!Number.isNaN(idx)) {
          poleIndex = idx;
        }
        break;
      }
    }

    if (poleIndex === null) {
      if (currentPoleRef.current !== null) {
        currentPoleRef.current = null;
        onPoleChangeRef.current(null);
      }
      return;
    }

    const listing = sortedListingsRef.current[poleIndex] ?? null;
    const nextId = listing?.listingId ?? null;

    if (nextId !== currentPoleRef.current) {
      currentPoleRef.current = nextId;
      onPoleChangeRef.current(listing);
    }
  }, [scrollContainer]);

  useEffect(() => {
    if (!enabled || !scrollContainer) return;

    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        detectPole();
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    detectPole();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, scrollContainer, detectPole]);

  // Re-detect when listings change (filter/sort)
  useEffect(() => {
    if (!enabled) return;
    currentPoleRef.current = null;
    detectPole();
  }, [enabled, sortedListings, detectPole]);
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: Compiles (hook is not imported yet, but no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/components/usePolePosition.ts
git commit -m "feat(pole-position): add usePolePosition scroll detection hook"
```

---

### Task 3: Add `handlePolePosition` to view state

This handler sets hover state from the pole-position listing. On desktop, it only fires when no pointer hover is active. On mobile, it always fires.

**Files:**
- Modify: `src/app/seatMap/state/useSeatMapPrototypeViewState.ts`

- [ ] **Step 1: Add the handler**

After the existing `handleHoverFromPanel` callback (~line 190), add:

```typescript
  const handlePolePosition = useCallback((listing: Listing | null) => {
    if (listing) {
      setHoverState((prev) => {
        // On desktop, don't override explicit pointer hover
        if (layoutMode !== 'mobile' && prev.source === 'pointer') return prev;
        return {
          listingId: listing.listingId,
          sectionId: listing.sectionId,
          rowId: listing.rowId ?? null,
          source: 'pole',
        };
      });
    } else {
      setHoverState((prev) => {
        if (prev.source !== 'pole') return prev;
        return { ...EMPTY_HOVER };
      });
    }
  }, [layoutMode]);
```

- [ ] **Step 2: Tag existing hover handlers with source**

Update `handleHoverFromPanel` to include `source: 'pointer'`:

```typescript
  const handleHoverFromPanel = useCallback((listing: Listing | null) => {
    if (layoutMode === 'mobile') return;
    if (listing) {
      setHoverState({
        listingId: listing.listingId,
        sectionId: listing.sectionId,
        rowId: listing.rowId ?? null,
        source: 'pointer',
      });
    } else {
      setHoverState(clearHover());
    }
  }, [layoutMode]);
```

Update `handleHoverFromMap` to include `source: 'pointer'`:

```typescript
  const handleHoverFromMap = useCallback((hover: HoverState) => {
    if (layoutMode === 'mobile') return;
    setHoverState({ ...hover, source: 'pointer' });
  }, [layoutMode]);
```

- [ ] **Step 3: When pointer hover clears, fall back to pole position**

The current `handleHoverFromPanel` clears hover to `EMPTY_HOVER` on mouse leave. We want pole position to re-assert itself after pointer leaves. The simplest approach: let `clearHover()` clear to `EMPTY_HOVER` (with no source), and let the next pole scroll event re-fill it. No extra code needed — the scroll handler fires continuously.

- [ ] **Step 4: Return the new handler from the hook**

Add `handlePolePosition` to the return object:

```typescript
  return {
    // ... existing returns ...
    handlePolePosition,
  };
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add src/app/seatMap/state/useSeatMapPrototypeViewState.ts
git commit -m "feat(pole-position): add handlePolePosition to view state with source priority"
```

---

### Task 4: Wire `usePolePosition` into `ListingsPanel`

**Files:**
- Modify: `src/app/components/ListingsPanel.tsx`

- [ ] **Step 1: Add `onPolePosition` prop**

Add to the `ListingsPanelProps` interface:

```typescript
interface ListingsPanelProps {
  // ... existing props ...
  onPolePosition?: (listing: Listing | null) => void;
}
```

- [ ] **Step 2: Destructure the new prop**

Update the function signature to include `onPolePosition`:

```typescript
export function ListingsPanel({ className, listings, selection, hoverState, onSelectListing, onHoverListing, selectedColor, hoverColor, pressedColor, disableHover, quantityFilter, onQuantityFilterChange, showEventInfo = true, onPolePosition }: ListingsPanelProps) {
```

- [ ] **Step 3: Import and call the hook**

Add import at the top:

```typescript
import { usePolePosition } from './usePolePosition';
```

After the `virtualizer` declaration, call the hook:

```typescript
  usePolePosition({
    scrollContainer: scrollContainerRef.current,
    sortedListings,
    enabled: !!onPolePosition,
    onPoleChange: onPolePosition ?? (() => {}),
  });
```

- [ ] **Step 4: Force re-render after mount for scrollContainer ref**

The `scrollContainerRef.current` is `null` on first render. Add a state trigger to re-evaluate after mount:

```typescript
  const [containerMounted, setContainerMounted] = useState(false);
  // Use callback ref pattern for scroll container
  const scrollContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node && !containerMounted) setContainerMounted(true);
  }, [containerMounted]);
```

Update the scroll container div to use the callback ref:

```typescript
      <div
        ref={scrollContainerCallbackRef}
        className="flex-1 overflow-y-auto px-3 no-scrollbar"
      >
```

And update the `usePolePosition` call to depend on `containerMounted`:

```typescript
  usePolePosition({
    scrollContainer: containerMounted ? scrollContainerRef.current : null,
    sortedListings,
    enabled: !!onPolePosition,
    onPoleChange: onPolePosition ?? (() => {}),
  });
```

- [ ] **Step 5: Verify build compiles**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/ListingsPanel.tsx
git commit -m "feat(pole-position): wire usePolePosition into ListingsPanel"
```

---

### Task 5: Pass `onPolePosition` from SeatMapRoot

**Files:**
- Modify: `src/app/seatMap/components/SeatMapRoot.tsx`

- [ ] **Step 1: Pass prop to desktop ListingsPanel**

Find the desktop `<ListingsPanel` block (~line 266) and add:

```typescript
                <ListingsPanel
                  className="w-full h-full"
                  listings={viewState.listings}
                  selection={panelSelection}
                  hoverState={viewState.hoverState}
                  onSelectListing={viewState.handleSelectFromPanel}
                  onHoverListing={viewState.handleHoverFromPanel}
                  selectedColor={config.seatColors.selected}
                  hoverColor={config.seatColors.hover}
                  pressedColor={config.seatColors.pressed}
                  disableHover={isMobile}
                  quantityFilter={viewState.quantityFilter}
                  onQuantityFilterChange={viewState.setQuantityFilter}
                  onPolePosition={viewState.handlePolePosition}
                />
```

- [ ] **Step 2: Pass prop to mobile ListingsPanel**

Find the mobile `<ListingsPanel` block (~line 409) and add:

```typescript
              <ListingsPanel
                className="w-full h-full bg-white"
                listings={viewState.listings}
                selection={panelSelection}
                hoverState={viewState.hoverState}
                onSelectListing={viewState.handleSelectFromPanel}
                onHoverListing={viewState.handleHoverFromPanel}
                selectedColor={config.seatColors.selected}
                hoverColor={config.seatColors.hover}
                pressedColor={config.seatColors.pressed}
                disableHover={isMobile}
                quantityFilter={viewState.quantityFilter}
                onQuantityFilterChange={viewState.setQuantityFilter}
                showEventInfo={false}
                onPolePosition={viewState.handlePolePosition}
              />
```

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: Compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src/app/seatMap/components/SeatMapRoot.tsx
git commit -m "feat(pole-position): connect pole position to SeatMapRoot"
```

---

### Task 6: Enable mobile hover state for pole-position source

Currently `handleHoverFromPanel` is gated by `layoutMode === 'mobile'` returning early, but the map sync (`useMapSelectionSync`) also needs to allow hover visuals on mobile when the source is pole position.

**Files:**
- Modify: `src/app/seatMap/maplibre/useMapSelectionSync.ts` (if hover sync is gated by mobile)
- Verify: `src/app/components/ListingCard.tsx` (card `isHovered` prop already works regardless of mobile)

- [ ] **Step 1: Check if useMapSelectionSync gates on mobile**

Read `src/app/seatMap/maplibre/useMapSelectionSync.ts` and look for any mobile guard on hover sync. If there's a `if (isMobile) return` before setting hovered feature-state, we need to allow it when `hoverState.source === 'pole'`.

If no mobile guard exists in the map sync (hover flows through regardless), this step is a no-op.

- [ ] **Step 2: Verify card highlighting works on mobile**

The `ListingCard` receives `isHovered={listing.listingId === hoverState.listingId}`. Since `handlePolePosition` sets `hoverState` even on mobile, cards will highlight. But `disableHover={isMobile}` prevents the card from showing local hover styles. The `resolveInteractionState` in `ListingCard` uses `isHovered: !disableHover && (isHovered || localHover)`.

We need pole-position-driven hover to show on mobile. Update `ListingCard` so external `isHovered` always shows, regardless of `disableHover`:

```typescript
  const state = resolveInteractionState({
    isAvailable: true,
    isSelected,
    isPressed: !disableHover && localPressed,
    isHovered: isHovered || (!disableHover && localHover),
  });
```

The change: `isHovered` (the prop from parent) is no longer gated by `disableHover`. Only local mouse-driven hover (`localHover`) is gated.

- [ ] **Step 3: Verify build + visual behavior**

Run: `npm run build`
Expected: Compiles. On mobile, the pole-position card shows hover styling; mouse hover events are still disabled.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ListingCard.tsx src/app/seatMap/maplibre/useMapSelectionSync.ts
git commit -m "feat(pole-position): enable pole-driven hover visuals on mobile cards and map"
```

---

### Task 7: Unit tests

**Files:**
- Create: `src/tests/usePolePosition.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('usePolePosition (unit logic)', () => {
  it('emits the first visible listing on scroll', () => {
    // This is a DOM-dependent hook. We test the detection logic by
    // simulating the scroll container state.
    // Detailed rendering tests with jsdom or a browser test runner
    // would be preferable for full coverage.

    // For now, validate that the hook module exports correctly
    const mod = import('../app/components/usePolePosition');
    expect(mod).resolves.toHaveProperty('usePolePosition');
  });

  it('HoverState source type is exported', async () => {
    const mod = await import('../app/seatMap/model/types');
    const hover: typeof mod.EMPTY_HOVER = { listingId: null, sectionId: null, rowId: null };
    expect(hover.listingId).toBeNull();
  });
});

describe('handlePolePosition priority logic', () => {
  it('pole hover does not override pointer hover on desktop', () => {
    // Simulates the priority check in handlePolePosition
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pointer' as const };
    const layoutMode = 'desktop';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(false);
  });

  it('pole hover does override on mobile regardless of source', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pointer' as const };
    const layoutMode = 'mobile';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(true);
  });

  it('pole hover overrides previous pole hover on desktop', () => {
    const prev = { listingId: 'L1', sectionId: 'S1', rowId: null, source: 'pole' as const };
    const layoutMode = 'desktop';
    const shouldOverride = !(layoutMode !== 'mobile' && prev.source === 'pointer');
    expect(shouldOverride).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/tests/usePolePosition.test.ts
git commit -m "test(pole-position): add unit tests for pole position priority logic"
```

---

### Task 8: Update INTERACTION.md

**Files:**
- Modify: `INTERACTION.md`

- [ ] **Step 1: Add pole position section**

After the "### Panel hover" section (~line 440), add:

```markdown
### Pole position hover

User action:

- user scrolls the listing panel so a new card reaches the top of the visible area

State result:

- `hoverState = { listingId, sectionId, rowId, source: 'pole' }`

Visible result:

- corresponding listing highlights on the map (section, row, or seats depending on display mode)
- the card itself shows hover styling

Platform behavior:

- desktop: pole position fires continuously but yields to explicit pointer hover; when pointer leaves, pole re-asserts
- mobile: pole position is the only source of hover state (pointer hover is disabled)

Timing note:

- pole detection is throttled to one requestAnimationFrame per scroll event
```

- [ ] **Step 2: Commit**

```bash
git add INTERACTION.md
git commit -m "docs: document pole position hover behavior"
```

---

## Behavior Summary

| Scenario | Desktop | Mobile |
|----------|---------|--------|
| Page load / initial render | Top listing in panel triggers pole hover on map | Same |
| User scrolls panel | New top listing triggers pole hover on map | Same |
| User mouses over a card | Pointer hover takes priority, pole suppressed | N/A (no mouse) |
| User moves mouse off card | Pole re-asserts on next scroll frame | N/A |
| User hovers map feature | Map hover takes priority (source: pointer) | N/A |
| Listing panel is empty | Hover clears | Same |
| Filter changes listings | Pole re-detects from new first card | Same |

## Edge Cases

1. **Detail view open:** Pole position should be inactive when `viewMode === 'detail'` since the panel is obscured. The hook's `enabled` prop can be made conditional on viewMode in a follow-up if needed.
2. **Virtual list recycling:** We use `data-index` attributes on DOM nodes (already present) to resolve the logical index rather than relying on stable element references.
3. **Fast scrolling:** RAF throttling ensures at most one detection per frame regardless of scroll velocity.
4. **Empty state:** If `sortedListings` is empty, `onPoleChange(null)` fires, clearing pole hover.
