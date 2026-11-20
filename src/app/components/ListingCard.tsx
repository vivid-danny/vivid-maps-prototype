import { memo, useState, type CSSProperties } from 'react';
import type { Listing } from '../seatMap/model/types';
import { useHoverIntent } from './useHoverIntent';
import { formatPrice, PERK_LABELS } from '../seatMap/behavior/utils';
import { resolveInteractionState } from '../seatMap/behavior/visualState';
import { MetaLine } from './listingRow/MetaLine';
import { PriceStack } from './listingRow/PriceStack';

/**
 * Production's listing row: an 80px band whose left edge is a zone-colored
 * accent bar, then the seat view, then the text block, then the price lane.
 * The row's border sits on the thumbnail and the two text columns rather than
 * wrapping the whole card, so the accent bar reads as the card's edge.
 */
const CARD_COLORS: Record<string, { bg: string; border: string }> = {
  available: { bg: '#FFFFFF', border: '#D3D3DC' },
  hover:     { bg: '#F6F6FB', border: '#717488' },
  pressed:   { bg: '#F6F6FB', border: '#717488' },
  selected:  { bg: '#F6F6FB', border: '#717488' },
};

interface ListingCardProps {
  listing: Listing;
  isSelected: boolean;
  isHovered: boolean;
  /** Zone color for the accent bar, or null when the map isn't zone-colored. */
  accentColor: string | null;
  /** Cheapest listing in its section; drives production's green line. */
  isLowestInSection?: boolean;
  onClick: (listing: Listing) => void;
  onHover: (listing: Listing | null) => void;
  disableHover?: boolean;
}

function ListingCardInner({
  listing,
  isSelected,
  isHovered,
  accentColor,
  isLowestInSection = false,
  onClick,
  onHover,
  disableHover = false,
}: ListingCardProps) {
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

  const state = resolveInteractionState({
    isAvailable: true,
    isSelected,
    isPressed: !disableHover && localPressed,
    isHovered: isHovered || (!disableHover && localHover),
  });
  const colors = CARD_COLORS[state] ?? CARD_COLORS.available!;

  const rowStyle: CSSProperties = {
    backgroundColor: colors.bg,
    // Without an accent bar the row still needs a left edge to close it.
    borderLeft: accentColor ? `6px solid ${accentColor}` : `1px solid ${colors.border}`,
  };
  const edgeStyle: CSSProperties = { borderColor: colors.border };

  // The row lives on the meta line now, so the title names the section only.
  const locationLabel = `Section ${listing.sectionLabel}`;

  return (
    <div
      onClick={() => onClick(listing)}
      onMouseEnter={disableHover ? undefined : handleMouseEnter}
      onMouseLeave={disableHover ? undefined : handleMouseLeave}
      onMouseDown={disableHover ? undefined : () => setLocalPressed(true)}
      onMouseUp={disableHover ? undefined : () => setLocalPressed(false)}
      className="relative flex h-20 cursor-pointer rounded-sm transition-colors"
      style={rowStyle}
    >
      {/* Seat view — a fixed lane so the text block starts on the same line in every row */}
      <div className="h-full w-[100px] shrink-0 border-y" style={edgeStyle}>
        <img
          src={listing.seatViewUrl}
          alt={`View from Section ${listing.sectionLabel}`}
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex min-w-0 grow items-center overflow-hidden border-y" style={edgeStyle}>
        {/* Fixed three-line block: the title lane stays put whether or not the
            green line is there, which a centered variable-height block breaks. */}
        <div className="flex h-[54px] min-w-0 flex-col pl-2">
          <p className="truncate text-small font-medium text-ink">{locationLabel}</p>
          <MetaLine
            parts={[
              listing.rowNumber === null ? null : { text: `Row ${listing.rowNumber}`, bold: true },
              {
                text: `${listing.quantityAvailable} ${listing.quantityAvailable === 1 ? 'ticket' : 'tickets'}`,
              },
              ...listing.perks.map((perk) => ({ text: PERK_LABELS[perk] })),
            ]}
          />
          {isLowestInSection && (
            <p className="truncate text-caption font-medium text-[#008442]">
              Lowest Price in Section
            </p>
          )}
        </div>
      </div>

      <PriceStack
        price={formatPrice(listing.price)}
        dealScore={listing.dealScore}
        borderColor={colors.border}
      />
    </div>
  );
}

export const ListingCard = memo(ListingCardInner);
