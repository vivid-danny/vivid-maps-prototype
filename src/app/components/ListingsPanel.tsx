import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  quantityFilter?: number;
  onQuantityFilterChange?: (qty: number) => void;
  showEventInfo?: boolean;
  onPolePosition?: (listing: Listing | null) => void;
}

export function ListingsPanel({ className, listings, selection, hoverState, onSelectListing, onHoverListing, disableHover, quantityFilter, onQuantityFilterChange, showEventInfo = true, onPolePosition }: ListingsPanelProps) {
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
    paddingStart: 4,
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
      {/* Event info */}
      {showEventInfo && (
        <div className="px-4 py-3 flex items-center gap-3 bg-white">
          <div className="w-12 h-12 rounded-lg bg-[#0e3386] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm leading-tight">Chicago Cubs vs Baltimore Orioles</div>
            <div className="text-xs text-gray-500 mt-0.5">Oriole Park at Camden Yards in Baltimore, MD</div>
            <div className="text-xs text-gray-500">Wed, Apr 9 at 7:05 PM</div>
          </div>
        </div>
      )}
      {/* Quantity filter */}
      {onQuantityFilterChange && (
        <div className={`h-12 flex items-center bg-white${disableHover ? ' px-3 mt-[10px]' : ' px-3'}`}>
          <div className="relative w-full">
            <select
              value={quantityFilter ?? 2}
              onChange={(e) => onQuantityFilterChange(Number(e.target.value))}
              className="appearance-none w-full text-sm text-gray-700 bg-white rounded-md px-3 pr-7 h-9 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D63384] focus:border-[#D63384]"
              style={{ border: '1px solid oklch(88% 0.01 320)' }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'ticket' : 'tickets'}</option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'oklch(60% 0.015 320)' }}
            />
          </div>
        </div>
      )}
      {/* Header */}
      <div className={`flex items-center bg-white${disableHover ? ' px-3 pt-2 pb-3' : ' px-3 pt-2 pb-3'}`}>
        <h2 className="text-base text-gray-900">
          <span className="font-bold">{sortedListings.length}</span>
          <span className="font-medium"> {sortedListings.length === 1 ? 'listing' : 'listings'}</span>
          {selection.sectionId && (
            <span className="font-normal text-gray-500">
              {' '}in {selection.rowId ? `Row ${selection.rowId.replace(/^[A-Z]+/, '')}` : `Section ${listings.find(l => l.sectionId === selection.sectionId)?.sectionLabel || selection.sectionId}`}
            </span>
          )}
        </h2>
        <div className="ml-auto relative shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'price' | 'dealScore')}
            className="appearance-none text-sm text-gray-700 bg-white rounded-md pl-3 pr-7 h-8 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#D63384] focus:border-[#D63384]"
            style={{ border: '1px solid oklch(88% 0.01 320)' }}
          >
            <option value="price">Lowest price</option>
            <option value="dealScore">Deal score</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: 'oklch(60% 0.015 320)' }}
          />
        </div>
      </div>

      {/* Scrollable virtualized list */}
      <div
        ref={scrollContainerCallbackRef}
        className="flex-1 overflow-y-auto px-3 no-scrollbar"
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
