import { useState } from 'react';
import type { SectionData, SeatColors } from '../seatMap/model/types';
import { PADDING, getSeatRowWidth, getSectionHeight } from './constants';
import { useHoverIntent } from './useHoverIntent';
import { getSectionLabelVisualState, getSectionVisualState, isSectionAvailable } from '../seatMap/behavior/rules';

interface SectionViewProps {
  section: SectionData;
  seatsPerRow: number;
  isSelected: boolean;
  onSelectSection: (sectionId: string) => void;
  seatColors: SeatColors;
  label: string;
  externalHover?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  hoverTransitionMs?: number;
}

export function SectionView({
  section,
  seatsPerRow,
  isSelected,
  onSelectSection,
  seatColors,
  label,
  externalHover = false,
  onHoverChange,
  hoverTransitionMs = 150,
}: SectionViewProps) {
  const [localHover, setLocalHover] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const hoverIntent = useHoverIntent<boolean>(onHoverChange, false);

  // Combine local and external hover states
  const isHovered = localHover || externalHover;

  const isAvailable = isSectionAvailable(section);

  // Calculate dimensions based on content using shared constants
  const width = getSeatRowWidth(seatsPerRow);
  const height = getSectionHeight(section.rows.length);
  const contentWidth = width - PADDING * 2;
  const contentHeight = height - PADDING * 2;

  const visualState = getSectionVisualState({
    isAvailable,
    isSelected,
    isPressed,
    isHovered,
  });

  let fillColor: string;
  switch (visualState) {
    case 'unavailable':
      fillColor = seatColors.unavailable;
      break;
    case 'selected':
      fillColor = seatColors.selected;
      break;
    case 'pressed':
      fillColor = seatColors.pressed;
      break;
    case 'hover':
      fillColor = seatColors.hover;
      break;
    case 'available':
    default:
      fillColor = seatColors.available;
      break;
  }

  const borderRadius = 2;

  // Center position for label
  const centerX = width / 2;
  const centerY = height / 2;

  const labelVisualState = getSectionLabelVisualState({
    isAvailable,
    isSelected,
    isPressed,
    isHovered,
  });

  let labelColor: string;
  switch (labelVisualState) {
    case 'unavailable':
      labelColor = seatColors.labelUnavailable;
      break;
    case 'active':
      labelColor = seatColors.labelSelected;
      break;
    case 'default':
    default:
      labelColor = seatColors.labelDefault;
      break;
  }

  // Label styling
  const labelStyle = {
    fontFamily: 'GT Walsheim, sans-serif',
    fontSize: '8px',
    fontWeight: 700,
    fill: labelColor,
    pointerEvents: 'none' as const,
  };

  if (!isAvailable) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-default block"
      >
        <rect
          x={PADDING}
          y={PADDING}
          width={contentWidth}
          height={contentHeight}
          rx={borderRadius}
          ry={borderRadius}
          fill={fillColor}
          style={{ transition: `fill ${hoverTransitionMs}ms ease-out` }}
        />
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="central"
          style={labelStyle}
        >
          {label}
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="cursor-pointer block"
      onClick={() => onSelectSection(section.sectionId)}
      onMouseEnter={onHoverChange ? () => {
        setLocalHover(true);
        hoverIntent.enter(true);
      } : undefined}
      onMouseLeave={onHoverChange ? () => {
        setLocalHover(false);
        setIsPressed(false);
        hoverIntent.leave();
      } : undefined}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      <rect
        x={PADDING}
        y={PADDING}
        width={contentWidth}
        height={contentHeight}
        rx={borderRadius}
        ry={borderRadius}
        fill={fillColor}
        style={{ transition: `fill ${hoverTransitionMs}ms ease-out` }}
      />
      <text
        x={centerX}
        y={centerY}
        textAnchor="middle"
        dominantBaseline="central"
        style={labelStyle}
      >
        {label}
      </text>
    </svg>
  );
}
