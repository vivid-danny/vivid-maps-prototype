import { memo, useState, type CSSProperties } from 'react';
import type { Listing } from '../seatMap/model/types';
import { useHoverIntent } from './useHoverIntent';
import { lightenColor, formatPrice, PERK_LABELS } from '../seatMap/behavior/utils';
import { resolveInteractionState } from '../seatMap/behavior/visualState';

const LISTING_CARD_PADDING = { top: 12, right: 20, bottom: 12, left: 12 };

interface ListingCardProps {
  listing: Listing;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (listing: Listing) => void;
  onHover: (listing: Listing | null) => void;
  selectedColor?: string;
  hoverColor?: string;
  pressedColor?: string;
  disableHover?: boolean;
}

function ListingCardInner({ listing, isSelected, isHovered, onClick, onHover, selectedColor = '#312784', hoverColor = '#7A1D59', pressedColor = '#3E0649', disableHover = false }: ListingCardProps) {
  const hoverIntent = useHoverIntent<Listing | null>(disableHover ? undefined : onHover, null);
  const [localHover, setLocalHover] = useState(false);
  const [localPressed, setLocalPressed] = useState(false);
  const ticketCount = listing.seatIds.length;
  const ticketLabel = ticketCount === 1 ? 'ticket' : 'tickets';

  const handleMouseEnter = () => {
    setLocalHover(true);
    hoverIntent.enter(listing);
  };

  const handleMouseLeave = () => {
    setLocalHover(false);
    setLocalPressed(false);
    hoverIntent.leave();
  };

  const cardBase = 'flex items-center justify-between rounded border cursor-pointer transition-colors ';
  let cardClass = cardBase;
  const paddingStyle = {
    paddingTop: LISTING_CARD_PADDING.top,
    paddingRight: LISTING_CARD_PADDING.right,
    paddingBottom: LISTING_CARD_PADDING.bottom,
    paddingLeft: LISTING_CARD_PADDING.left,
  };
  let cardStyle: CSSProperties;

  const state = resolveInteractionState({
    isAvailable: true,
    isSelected,
    isPressed: !disableHover && localPressed,
    isHovered: !disableHover && (isHovered || localHover),
  });
  const resolvedColor =
    state === 'selected' ? selectedColor :
    state === 'pressed'  ? pressedColor  :
    state === 'hover'    ? hoverColor    : null;
  cardStyle = resolvedColor
    ? { ...paddingStyle, backgroundColor: lightenColor(resolvedColor, 80), borderColor: resolvedColor }
    : { ...paddingStyle, backgroundColor: '#fff', borderColor: '#e5e7eb' };

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
          className="w-18 h-18 rounded object-cover flex-shrink-0"
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-medium text-gray-900">
            Section {listing.sectionLabel}, Row {listing.rowNumber}
          </span>
          <span className="text-sm text-gray-500">
            {ticketCount} {ticketLabel}
          </span>
          {(listing.dealScore >= 6 || listing.perks.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {listing.dealScore >= 6 && (
                <span className="text-[12px] leading-tight px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">
                  {listing.dealScore.toFixed(1)}
                </span>
              )}
              {listing.perks.map((perk) => (
                <span
                  key={perk}
                  className="text-[12px] leading-tight px-1.5 py-0.5 rounded bg-gray-100 text-gray-500"
                >
                  {PERK_LABELS[perk]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Price */}
      <div className="text-lg font-bold text-gray-900">
        {formatPrice(listing.price)} <span className="text-sm text-gray-500">ea.</span>
      </div>
    </div>
  );
}

export const ListingCard = memo(ListingCardInner);
