import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Listing, SelectionState, HoverState } from '../seatMap/model/types';
import { ListingCard } from './ListingCard';

const TABS = ['Tickets', 'Parking', 'Event Details', 'Disclosures'] as const;

interface ListingsPanelProps {
  className?: string;
  listings: Listing[];
  selection: SelectionState;
  hoverState: HoverState;
  onSelectListing: (listing: Listing) => void;
  onHoverListing: (listing: Listing | null) => void;
  selectedColor?: string;
  hoverColor?: string;
  pressedColor?: string;
  disableHover?: boolean;
  quantityFilter?: number;
  onQuantityFilterChange?: (qty: number) => void;
}

export function ListingsPanel({ className, listings, selection, hoverState, onSelectListing, onHoverListing, selectedColor, hoverColor, pressedColor, disableHover, quantityFilter, onQuantityFilterChange }: ListingsPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'price' | 'dealScore'>('price');

  const filteredListings = useMemo(() => {
    if (!selection.sectionId) {
      return listings;
    }
    if (selection.rowId) {
      return listings.filter(
        (l) => l.sectionId === selection.sectionId && l.rowId === selection.rowId
      );
    }
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
    estimateSize: () => 88,
    gap: 16,
    overscan: 5,
  });

  const qty = quantityFilter ?? 2;

  return (
    <div className={`flex flex-col min-h-0 mt-4 min-[801px]:mt-6 bg-white gap-6 ${className}`}>
      {/* Tab strip */}
      <div className="bg-white shrink-0 px-4 min-[801px]:px-6">
        <div className="flex border-b border-[#efeff6]">
          {TABS.map((tab) => (
            <div
              key={tab}
              className="relative flex flex-col items-center justify-center shrink-0 cursor-default"
            >
              <div className="px-4 py-2 flex items-center justify-center">
                <span className={`text-[14px] leading-[21px] whitespace-nowrap ${
                  tab === 'Tickets'
                    ? 'font-bold text-[#04092c]'
                    : 'font-normal text-[#717488]'
                }`}>
                  {tab}
                </span>
              </div>
              {tab === 'Tickets' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#ce3197] rounded-[1px]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 px-4 min-[801px]:px-6 bg-white shrink-0">
        {/* Price chip — static */}
        <div className="flex items-center justify-center gap-1 px-3 py-1 rounded-[4px] border border-[#d3d3dc] bg-white text-sm text-[#04092c] whitespace-nowrap cursor-default flex-1">
          $28 – $1,350
        </div>

        {/* Tickets chip — functional */}
        {onQuantityFilterChange ? (
          <div className="relative flex items-center justify-center gap-1 px-3 py-1 rounded-[4px] border border-[#d3d3dc] bg-white text-sm text-[#04092c] whitespace-nowrap flex-1">
            {qty} {qty === 1 ? 'Ticket' : 'Tickets'}
            <select
              value={qty}
              onChange={(e) => onQuantityFilterChange(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              aria-label="Number of tickets"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'Ticket' : 'Tickets'}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 px-3 py-1 rounded-[4px] border border-[#d3d3dc] bg-white text-sm text-[#04092c] whitespace-nowrap cursor-default flex-1">
            {qty} {qty === 1 ? 'Ticket' : 'Tickets'}
          </div>
        )}

        {/* Zones chip — static */}
        <div className="flex items-center justify-center gap-1 px-3 py-1 rounded-[4px] border border-[#d3d3dc] bg-white text-sm text-[#04092c] whitespace-nowrap cursor-default flex-1">
          Zones
        </div>

        {/* Perks chip — static */}
        <div className="flex items-center justify-center gap-1 px-3 py-1 rounded-[4px] border border-[#d3d3dc] bg-white text-sm text-[#04092c] whitespace-nowrap cursor-default flex-1">
          Perks
        </div>
      </div>

      {/* Count + sort header */}
      <div className="px-4 min-[801px]:px-6 flex items-center bg-white shrink-0">
        <h2 className="text-sm font-bold text-[#04092c]">
          {sortedListings.length} {sortedListings.length === 1 ? 'listing' : 'listings'}
          {selection.sectionId && (
            <span className="font-normal text-[#717488]">
              {' '}in {selection.rowId ? `Row ${selection.rowId.replace(/^[A-Z]+/, '')}` : `Section ${listings.find(l => l.sectionId === selection.sectionId)?.sectionLabel || selection.sectionId}`}
            </span>
          )}
        </h2>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'price' | 'dealScore')}
          className="ml-auto text-sm text-[#04092c] bg-transparent rounded px-2 cursor-pointer outline-none"
        >
          <option value="price">Lowest Price</option>
          <option value="dealScore">Deal score</option>
        </select>
      </div>

      {/* Scrollable virtualized list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 min-[801px]:px-6 no-scrollbar"
      >
        {sortedListings.length === 0 ? (
          <div className="text-center text-[#717488] text-sm py-8">
            No listings available
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
                    selectedColor={selectedColor}
                    hoverColor={hoverColor}
                    pressedColor={pressedColor}
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
