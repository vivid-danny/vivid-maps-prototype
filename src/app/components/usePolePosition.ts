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
          break;
        }
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
