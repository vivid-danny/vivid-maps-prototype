import type { CSSProperties } from 'react';
import { darkenHex } from '../seatMap/behavior/utils';

interface PinProps {
  price: number; // in cents
  x: number;
  y: number;
  currentScale: number;
  isSelected?: boolean;
  selectedColor?: string;
  isHovered?: boolean;
  hoverColor?: string;
  dealScore?: number;
  seatViewUrl?: string;
  sectionLabel?: string;
  rowNumber?: number;
}

export function Pin({ price, x, y, currentScale, isSelected, selectedColor = '#312784', isHovered, hoverColor = '#7A1D59', dealScore, seatViewUrl, sectionLabel, rowNumber }: PinProps) {
  const displayPrice = `$${Math.round(price / 100)}`;
  const inverseScale = (1 / currentScale) * (isSelected ? 1.875 : isHovered ? 1.5 : 1.25);
  const bgColor = isSelected ? darkenHex(selectedColor, 0.6) : isHovered ? darkenHex(hoverColor, 0.6) : '#1a1a2e';
  const zIndex = isSelected ? 20 : isHovered ? 15 : 10;
  const showDealScore = dealScore !== undefined && dealScore > 7;
  const showSeatView = (isSelected || isHovered) && seatViewUrl;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        '--pin-scale': inverseScale,
        transform: `translate(-50%, -100%) scale(var(--pin-scale))${isSelected ? ' translateY(-1px)' : ''}`,
        transformOrigin: 'center bottom',
        pointerEvents: 'none',
        zIndex,
        animation: isSelected
          ? 'pinSelectedIn 300ms cubic-bezier(0.075, 0.82, 0.165, 1)'
          : isHovered
            ? 'pinHoverIn 200ms cubic-bezier(0.075, 0.82, 0.165, 1)'
            : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      } as CSSProperties}
    >
      {/* Seat view card */}
      {showSeatView && (
        <div style={{ width: 160, borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginBottom: 4 }}>
          <div style={{ position: 'relative' }}>
            <img src={seatViewUrl} style={{ width: '100%', display: 'block', aspectRatio: '16/10', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 6, left: 6, background: '#fff', borderRadius: 2, padding: '2px 6px', fontSize: 8, lineHeight: '120%', fontWeight: 450, color: '#1a1a2e' }}>
              Section {sectionLabel}, Row {rowNumber}
            </div>
          </div>
        </div>
      )}
      {/* Pill body */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: bgColor,
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          padding: '4px 5px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {showDealScore && (
          <span
            style={{
              background: '#4CAF50',
              borderRadius: 2,
              padding: '2px 4px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
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
