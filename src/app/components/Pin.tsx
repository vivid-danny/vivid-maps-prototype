import { memo } from 'react';
import type { CSSProperties } from 'react';

interface PinProps {
  price: number; // in cents
  x: number;
  y: number;
  isSelected?: boolean;
  selectedColor?: string;
  isHovered?: boolean;
  hoverColor?: string;
  isPressed?: boolean;
  pressedColor?: string;
  defaultColor?: string;
  dealScore?: number;
  seatViewUrl?: string;
  sectionLabel?: string;
  rowNumber?: number;
  // When true, suppresses enter animations and uses CSS transitions instead.
  // Used for pins that are always mounted (e.g. section pins that transition to hover state
  // in-place) to avoid the opacity-0 flash that enter animations produce on existing elements.
  useTransition?: boolean;
}

export const Pin = memo(function Pin({ price, x, y, isSelected, selectedColor = '#141035', isHovered, hoverColor = '#310C24', isPressed, pressedColor = '#141035', defaultColor = '#1a1a2e', dealScore, seatViewUrl, sectionLabel, rowNumber, useTransition }: PinProps) {
  const displayPrice = `$${Math.round(price / 100)}`;
  // Multiplier is computed at render time (only changes on selection/hover, not zoom)
  // --map-scale CSS var is set by MapContainer via DOM mutation during zoom — no React re-render needed
  const pinMultiplier = isSelected ? 1.875 : isHovered ? 1.5 : 1.25;
  const bgColor = isSelected ? selectedColor : isPressed ? pressedColor : isHovered ? hoverColor : defaultColor;
  const zIndex = isHovered ? 30 : isSelected ? 20 : 10;
  const showDealScore = dealScore !== undefined && dealScore > 7;
  const showSeatView = isHovered && !isSelected && seatViewUrl;

  const animation = useTransition ? undefined : isSelected
    ? 'pinSelectedIn 300ms cubic-bezier(0.075, 0.82, 0.165, 1)'
    : isHovered
      ? 'pinHoverIn 200ms cubic-bezier(0.075, 0.82, 0.165, 1)'
      : undefined;

  return (
    <div
      className="flex flex-col items-center pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        '--pin-multiplier': pinMultiplier,
        transform: `translate(-50%, -100%) scale(calc(var(--pin-multiplier, 1.25) / var(--map-scale, 1)))${isSelected ? ' translateY(-1px)' : ''}`,
        transformOrigin: 'center bottom',
        zIndex,
        animation,
        transition: useTransition ? 'transform 200ms ease' : undefined,
      } as CSSProperties}
    >
      {/* Seat view card */}
      {showSeatView && (
        <div className="w-[160px] rounded-md overflow-hidden shadow-md mb-1">
          <div className="relative">
            <img src={seatViewUrl} className="w-full block aspect-[16/10] object-cover" />
            <div className="absolute top-1.5 left-1.5 bg-white rounded-sm px-1.5 py-0.5 text-[8px] leading-tight font-medium text-[#1a1a2e]">
              Section {sectionLabel}, Row {rowNumber}
            </div>
          </div>
        </div>
      )}
      {/* Pill body */}
      <div
        className="flex items-center gap-1 text-xs font-semibold leading-none px-[5px] py-1 rounded whitespace-nowrap text-center text-white"
        style={{
          background: bgColor,
          transition: useTransition ? 'background-color 200ms ease' : undefined,
        }}
      >
        {showDealScore && (
          <span className="rounded-sm px-1 py-0.5 text-[10px] font-bold bg-[#4CAF50]">
            {dealScore.toFixed(1)}
          </span>
        )}
        {displayPrice}
      </div>
      {/* Downward triangle arrow */}
      <div
        style={{
          width: 0,
          height: 0,
          margin: '0 auto',
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `4px solid ${bgColor}`,
          transition: useTransition ? 'border-top-color 200ms ease' : undefined,
        }}
      />
    </div>
  );
});
