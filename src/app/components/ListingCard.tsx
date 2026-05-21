import { memo, useState, type CSSProperties } from 'react';
import type { Listing } from '../seatMap/model/types';
import { useHoverIntent } from './useHoverIntent';
import { formatPrice, PERK_LABELS } from '../seatMap/behavior/utils';
import { resolveInteractionState } from '../seatMap/behavior/visualState';

const LISTING_CARD_PADDING = { top: 12, right: 20, bottom: 12, left: 12 };

const CARD_COLORS = {
  default:  { bg: '#FFFFFF', border: '#E0DCE3' },
  hover:    { bg: '#F6F6FB', border: '#717488' },
  pressed:  { bg: '#F6F6FB', border: '#717488' },
  selected: { bg: '#F6F6FB', border: '#717488' },
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
