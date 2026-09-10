import { useCallback, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Listing, SelectionState, HoverState } from '../seatMap/model/types';
import { ListingCard } from './ListingCard';
import { usePolePosition } from './usePolePosition';

interface ListingsPanelProps {
  className?: string;
  listings: Listing[];
  selection: SelectionState;
  hoverState: HoverState;
  onSelectListing: (listing: Listing) => void;
  onHoverListing: (listing: Listing | null) => void;
  disableHover?: boolean;
  onPolePosition?: (listing: Listing | null) => void;
}

export function ListingsPanel({ className, listings, selection, hoverState, onSelectListing, onHoverListing, disableHover, onPolePosition }: ListingsPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'price' | 'dealScore'>('price');
  const [containerMounted, setContainerMounted] = useState(false);

  const scrollContainerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    (scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node) setContainerMounted(true);
  }, []);

  // Filter listings based on selection
  const filteredListings = useMemo(() => {
    if (!selection.sectionId) {
      // No selection - show all listings
      return listings;
    }

    if (selection.rowId) {
      // Row selected - show only listings in that row
      return listings.filter(
        (l) => l.sectionId === selection.sectionId && l.rowId === selection.rowId
      );
    }

    // Section selected - show only listings in that section
    return listings.filter((l) => l.sectionId === selection.sectionId);
  }, [listings, selection.sectionId, selection.rowId]);

  const sortedListings = useMemo(() => {
    const sorted = [...filteredListings];
    if (sortBy === 'price') {
      sorted.sort((a, b) => a.price - b.price);
    } else {
      sorted.sort((a, b) => b.dealScore - a.dealScore);
    }
    return sorted;
  }, [filteredListings, sortBy]);

  const virtualizer = useVirtualizer({
    count: sortedListings.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    gap: 8,
    paddingStart: 0,
    paddingEnd: 12,
    overscan: 5,
  });

  usePolePosition({
    scrollContainer: containerMounted ? scrollContainerRef.current : null,
    sortedListings,
    enabled: !!onPolePosition,
    onPoleChange: onPolePosition ?? (() => {}),
  });

  return (
    <div className={`flex flex-col min-h-0 bg-white ${className}`}>
      {/* Header — Figma listings header: 24px row, Small/Bold count + borderless sort */}
      <div className="flex h-6 shrink-0 items-center gap-2 bg-white mb-4">
        <h2 className="min-w-0 flex-1 truncate text-small font-bold text-ink">
          {sortedListings.length} {sortedListings.length === 1 ? 'Listing' : 'Listings'}
          {selection.sectionId && (
            <span className="font-normal text-ink-secondary">
              {' '}in {selection.rowId ? `Row ${selection.rowId.replace(/^[A-Z]+/, '')}` : `Section ${listings.find(l => l.sectionId === selection.sectionId)?.sectionLabel || selection.sectionId}`}
            </span>
          )}
        </h2>
        {/* Sort: styled label + Figma sort icon, with the native <select> laid transparently over it */}
        <div className="relative flex shrink-0 items-center gap-1 rounded text-small text-ink has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-[#D63384]">
          <span className="whitespace-nowrap">{sortBy === 'price' ? 'Lowest Price' : 'Deal Score'}</span>
          <span aria-hidden className="relative h-6 w-2 shrink-0">
            <img
              src="/icons/sort.svg"
              alt=""
              draggable={false}
              className="absolute left-[-1px] top-1/2 h-[10px] w-[6px] -translate-y-1/2"
            />
          </span>
          <select
            aria-label="Sort listings"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'price' | 'dealScore')}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            <option value="price">Lowest Price</option>
            <option value="dealScore">Deal Score</option>
          </select>
        </div>
      </div>

      {/* Scrollable virtualized list */}
      <div
        ref={scrollContainerCallbackRef}
        className="flex-1 overflow-y-auto no-scrollbar"
      >
        {sortedListings.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            {selection.sectionId ? 'No tickets in this section' : 'No tickets available'}
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const listing = sortedListings[virtualRow.index]!;
              return (
                <div
                  key={listing.listingId}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ListingCard
                    listing={listing}
                    isSelected={listing.listingId === selection.listingId}
                    isHovered={listing.listingId === hoverState.listingId}
                    onClick={onSelectListing}
                    onHover={onHoverListing}
                    disableHover={disableHover}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
