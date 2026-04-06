import { useMemo, useState } from 'react';
import type { Listing, SelectionState, HoverState } from '../seatMap/model/types';
import type { ListingCardSize } from '../seatMap/config/types';
import { ListingCard } from './ListingCard';

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
  listingCardSize?: ListingCardSize;
}

export function ListingsPanel({ className, listings, selection, hoverState, onSelectListing, onHoverListing, selectedColor, hoverColor, pressedColor, disableHover, listingCardSize }: ListingsPanelProps) {
  const [sortBy, setSortBy] = useState<'price' | 'dealScore'>('price');

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

  return (
    <div className={`flex flex-col min-h-0 bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="px-4 h-12 flex items-center border-b border-gray-200 bg-white">
        <h2 className="text-sm font-semibold text-gray-900">
          {sortedListings.length} {sortedListings.length === 1 ? 'listing' : 'listings'}
          {selection.sectionId && (
            <span className="font-normal text-gray-500">
              {' '}in {selection.rowId ? `Row ${selection.rowId.replace(/^[A-Z]+/, '')}` : `Section ${listings.find(l => l.sectionId === selection.sectionId)?.sectionLabel || selection.sectionId}`}
            </span>
          )}
        </h2>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'price' | 'dealScore')}
          className="ml-auto text-xs text-gray-600 bg-transparent border border-gray-300 rounded px-2 py-1 cursor-pointer"
        >
          <option value="price">Lowest price</option>
          <option value="dealScore">Deal score</option>
        </select>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
        {sortedListings.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No listings available
          </div>
        ) : (
          sortedListings.map((listing) => (
            <ListingCard
              key={listing.listingId}
              listing={listing}
              isSelected={listing.listingId === selection.listingId}
              isHovered={listing.listingId === hoverState.listingId}
              onClick={onSelectListing}
              onHover={onHoverListing}
              selectedColor={selectedColor}
              hoverColor={hoverColor}
              pressedColor={pressedColor}
              disableHover={disableHover}
              size={listingCardSize}
            />
          ))
        )}
      </div>
    </div>
  );
}
