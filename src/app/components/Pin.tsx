import { memo } from 'react';
import type { CSSProperties } from 'react';
import type { InteractionState } from '../seatMap/behavior/visualState';
import { resolveInteractionState } from '../seatMap/behavior/visualState';

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
  // When true, allows pointer events so clicks land on the pin (used inside MapLibre Markers).
  // Default false — SVG renderer relies on pointer-events: none so clicks fall through to sections.
  interactive?: boolean;
}

interface PinAppearance {
  backgroundColor: string;
  textColor: string;
  pinMultiplier: number;
  zIndex: number;
  animation?: string;
  filter?: string;
  showSeatView: string | false | undefined;
}

function resolvePinAppearance(params: {
  pinState: InteractionState;
  defaultColor: string;
  hoverColor: string;
  pressedColor: string;
  selectedColor: string;
  seatViewUrl?: string;
  useTransition?: boolean;
}): PinAppearance {
  const { pinState, defaultColor, hoverColor, pressedColor, selectedColor, seatViewUrl, useTransition } = params;

  switch (pinState) {
    case 'selected':
      return {
        backgroundColor: selectedColor,
        textColor: '#000000',
        pinMultiplier: 1.875,
        zIndex: 20,
        animation: useTransition ? undefined : 'pinSelectedIn 300ms cubic-bezier(0.075, 0.82, 0.165, 1)',
        filter: 'drop-shadow(0 6px 12px rgba(4, 9, 44, 0.40))',
        showSeatView: false,
      };
    case 'pressed':
      return {
        backgroundColor: pressedColor,
        textColor: '#000000',
        pinMultiplier: 1.875,
        zIndex: 20,
        animation: undefined,
        filter: 'drop-shadow(0 6px 12px rgba(4, 9, 44, 0.18))',
        showSeatView: false,
      };
    case 'hover':
      return {
        backgroundColor: hoverColor,
        textColor: '#FFFFFF',
        pinMultiplier: 1.5,
        zIndex: 30,
        animation: useTransition ? undefined : 'pinHoverIn 200ms cubic-bezier(0.075, 0.82, 0.165, 1)',
        showSeatView: seatViewUrl,
      };
    default:
      return {
        backgroundColor: defaultColor,
        textColor: '#FFFFFF',
        pinMultiplier: 1.25,
        zIndex: 10,
        animation: undefined,
        showSeatView: false,
      };
  }
}

export const Pin = memo(function Pin({ price, x, y, isSelected, selectedColor = '#FFFFFF', isHovered, hoverColor = '#310C24', isPressed, pressedColor = '#FFFFFF', defaultColor = '#1a1a2e', dealScore, seatViewUrl, sectionLabel, rowNumber, useTransition, interactive }: PinProps) {
  const displayPrice = `$${Math.round(price / 100)}`;
  const pinState = resolveInteractionState({
    isAvailable: true,
    isSelected: !!isSelected,
    isPressed: !!isPressed,
    isHovered: !!isHovered,
  });
  const appearance = resolvePinAppearance({
    pinState,
    defaultColor,
    hoverColor,
    pressedColor,
    selectedColor,
    seatViewUrl,
    useTransition,
  });
  const showDealScore = dealScore !== undefined && dealScore > 7;

  return (
    <div
      className={`flex flex-col items-center ${interactive ? '' : 'pointer-events-none'} absolute`}
      style={{
        left: x,
        top: y,
        '--pin-multiplier': appearance.pinMultiplier,
        transform: `translate(-50%, -100%) scale(calc(var(--pin-multiplier, 1.25) / var(--map-scale, 1)))${pinState === 'selected' || pinState === 'pressed' ? ' translateY(-1px)' : ''}`,
        transformOrigin: 'center bottom',
        zIndex: appearance.zIndex,
        animation: appearance.animation,
        filter: appearance.filter,
        transition: useTransition ? '--pin-multiplier 200ms cubic-bezier(0.075, 0.82, 0.165, 1), filter 200ms ease' : undefined,
      } as CSSProperties}
    >
      {/* Seat view card */}
      {appearance.showSeatView && (
        <div className="w-[160px] rounded-md overflow-hidden shadow-md mb-1">
          <div className="relative">
            <img src={appearance.showSeatView} className="w-full block aspect-[16/10] object-cover" />
            <div className="absolute top-1.5 left-1.5 bg-white rounded-sm px-1.5 py-0.5 text-[8px] leading-tight font-medium text-[#1a1a2e]">
              Section {sectionLabel}, Row {rowNumber}
            </div>
          </div>
        </div>
      )}
      {/* Pill body */}
      <div
        className="flex items-center gap-1 text-xs font-semibold leading-none px-[5px] py-1 rounded whitespace-nowrap text-center"
        style={{
          background: appearance.backgroundColor,
          color: appearance.textColor,
          transition: useTransition ? 'background-color 200ms ease, color 200ms ease' : undefined,
        }}
      >
        {showDealScore && (
          <span className="rounded-sm bg-[#4CAF50] px-1 py-0.5 text-[10px] font-bold text-white">
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
          borderTop: `4px solid ${appearance.backgroundColor}`,
          transition: useTransition ? 'border-top-color 200ms ease' : undefined,
        }}
      />
    </div>
  );
});
