import { useState } from 'react';
import type { SectionData, SeatColors } from '../seatMap/model/types';
import { SEAT_SIZE, ROW_GAP, PADDING, getSeatRowWidth, getSectionHeight } from './constants';
import { useHoverIntent } from './useHoverIntent';

interface RowsViewProps {
  section: SectionData;
  seatsPerRow: number;
  selectedRowId: string | null;
  onSelectRow: (rowId: string) => void;
  seatColors: SeatColors;
  externalHoveredRowId?: string | null;
  onRowHover?: (rowId: string | null) => void;
  hoverTransitionMs?: number;
}

export function RowsView({
  section,
  seatsPerRow,
  selectedRowId,
  onSelectRow,
  seatColors,
  externalHoveredRowId = null,
  onRowHover,
  hoverTransitionMs = 150,
}: RowsViewProps) {
  const [localHoveredRowId, setLocalHoveredRowId] = useState<string | null>(null);
  const [pressedRowId, setPressedRowId] = useState<string | null>(null);
  const hoverIntent = useHoverIntent<string | null>(onRowHover, null);

  const width = getSeatRowWidth(seatsPerRow);
  const height = getSectionHeight(section.rows.length);
  const barWidth = width - PADDING * 2;  // Content width (without padding)
  const barHeight = SEAT_SIZE;
  const cornerRadius = barHeight / 2;

  const getRowColor = (rowId: string, isAvailable: boolean): string => {
    if (!isAvailable) return seatColors.unavailable;
    if (selectedRowId === rowId) return seatColors.selected;
    if (pressedRowId === rowId) return seatColors.pressed;
    // Combine local and external hover
    if (localHoveredRowId === rowId || externalHoveredRowId === rowId) return seatColors.hover;
    return seatColors.available;
  };

  const isRowAvailable = (row: typeof section.rows[0]): boolean => {
    return row.seats.some((seat) => seat.status === 'available');
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
    >
      {section.rows.map((row, rowIndex) => {
        const isAvailable = isRowAvailable(row);
        const y = PADDING + rowIndex * (SEAT_SIZE + ROW_GAP);

        return (
          <rect
            id={row.rowId}
            key={row.rowId}
            x={PADDING}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={getRowColor(row.rowId, isAvailable)}
            style={{ transition: `fill ${hoverTransitionMs}ms ease-out` }}
            className={isAvailable ? 'cursor-pointer' : 'cursor-default'}
            onClick={isAvailable ? () => onSelectRow(row.rowId) : undefined}
            onMouseEnter={isAvailable && onRowHover ? () => {
              setLocalHoveredRowId(row.rowId);
              hoverIntent.enter(row.rowId);
            } : undefined}
            onMouseLeave={isAvailable && onRowHover ? () => {
              setLocalHoveredRowId(null);
              setPressedRowId(null);
              hoverIntent.leave();
            } : undefined}
            onMouseDown={isAvailable ? () => setPressedRowId(row.rowId) : undefined}
            onMouseUp={isAvailable ? () => setPressedRowId(null) : undefined}
          />
        );
      })}
    </svg>
  );
}
