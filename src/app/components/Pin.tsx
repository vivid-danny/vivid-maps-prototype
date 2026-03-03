import type { CSSProperties } from 'react';

interface PinProps {
  price: number; // in cents
  x: number;
  y: number;
  currentScale: number;
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
}

export function Pin({ price, x, y, currentScale, isSelected, selectedColor = '#141035', isHovered, hoverColor = '#310C24', isPressed, pressedColor = '#141035', defaultColor = '#1a1a2e', dealScore, seatViewUrl, sectionLabel, rowNumber }: PinProps) {
  const displayPrice = `$${Math.round(price / 100)}`;
  const inverseScale = (1 / currentScale) * (isSelected ? 1.875 : isHovered ? 1.5 : 1.25);
  const bgColor = isSelected ? selectedColor : isPressed ? pressedColor : isHovered ? hoverColor : defaultColor;
  const zIndex = isHovered ? 30 : isSelected ? 20 : 10;
  const showDealScore = dealScore !== undefined && dealScore > 7;
  const showSeatView = isHovered && !isSelected && seatViewUrl;

  return (
    <div
      className="flex flex-col items-center pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        '--pin-scale': inverseScale,
        transform: `translate(-50%, -100%) scale(var(--pin-scale))${isSelected ? ' translateY(-1px)' : ''}`,
        transformOrigin: 'center bottom',
        zIndex,
        animation: isSelected
          ? 'pinSelectedIn 300ms cubic-bezier(0.075, 0.82, 0.165, 1)'
          : isHovered
            ? 'pinHoverIn 200ms cubic-bezier(0.075, 0.82, 0.165, 1)'
            : undefined,
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
        style={{ background: bgColor }}
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
        }}
      />
    </div>
  );
}
