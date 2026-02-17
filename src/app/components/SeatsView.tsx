import { useState } from 'react';
import type { SectionData, SeatColors, SeatData } from '../seatMap/model/types';
import { SEAT_SIZE, SEAT_GAP, getSeatRowWidth, getSectionHeight, getSeatCenter } from './constants';
import { useHoverIntent } from './useHoverIntent';
import { getSeatVisualState, isSeatAvailable } from '../seatMap/behavior/rules';

interface SeatsViewProps {
  section: SectionData;
  seatsPerRow: number;
  selectedListingId: string | null;
  selectedSeatIds: string[];
  onSelectListing: (listingId: string, seatIds: string[]) => void;
  seatColors: SeatColors;
  connectorWidth?: number;
  externalHoveredListingId?: string | null;
  onListingHover?: (listingId: string | null) => void;
  hoverTransitionMs?: number;
}

export function SeatsView({
  section,
  seatsPerRow,
  selectedListingId,
  selectedSeatIds,
  onSelectListing,
  seatColors,
  connectorWidth = 1,
  externalHoveredListingId = null,
  onListingHover,
  hoverTransitionMs = 150,
}: SeatsViewProps) {
  const [localHoveredListingId, setLocalHoveredListingId] = useState<string | null>(null);
  const [pressedListingId, setPressedListingId] = useState<string | null>(null);
  const hoverIntent = useHoverIntent<string | null>(onListingHover, null);

  const width = getSeatRowWidth(seatsPerRow);
  const height = getSectionHeight(section.rows.length);
  const radius = SEAT_SIZE / 2;

  // Build a map of listingId -> seatIds for grouped selection
  const listingToSeats = new Map<string, string[]>();
  section.rows.forEach((row) => {
    row.seats.forEach((seat) => {
      if (seat.listingId) {
        const existing = listingToSeats.get(seat.listingId) || [];
        existing.push(seat.seatId);
        listingToSeats.set(seat.listingId, existing);
      }
    });
  });

  const getSeatColor = (seat: SeatData): string => {
    const state = getSeatVisualState({
      seat,
      selectedListingId,
      pressedListingId,
      localHoveredListingId,
      externalHoveredListingId,
    });

    switch (state) {
      case 'unavailable':
        return seatColors.unavailable;
      case 'selected':
        return seatColors.selected;
      case 'pressed':
        return seatColors.pressed;
      case 'hover':
        return seatColors.hover;
      case 'available':
      default:
        return seatColors.available;
    }
  };

  const handleMouseEnter = onListingHover ? (seat: SeatData) => {
    if (!isSeatAvailable(seat)) return;
    setLocalHoveredListingId(seat.listingId!);
    hoverIntent.enter(seat.listingId!);
  } : undefined;

  const handleMouseLeave = onListingHover ? () => {
    setLocalHoveredListingId(null);
    setPressedListingId(null);
    hoverIntent.leave();
  } : undefined;

  const handleMouseDown = (seat: SeatData) => {
    if (!isSeatAvailable(seat)) return;
    setPressedListingId(seat.listingId!);
  };

  const handleMouseUp = () => {
    setPressedListingId(null);
  };

  const handleClick = (seat: SeatData) => {
    if (!isSeatAvailable(seat)) return;
    // All available seats now have a listingId
    const listingId = seat.listingId!;
    const seatIds = listingToSeats.get(listingId) || [seat.seatId];
    onSelectListing(listingId, seatIds);
  };

  // Check if two adjacent seats in the same row share a listing
  const hasConnector = (
    rowIndex: number,
    seatIndex: number
  ): boolean => {
    const row = section.rows[rowIndex];
    if (seatIndex >= row.seats.length - 1) return false;

    const current = row.seats[seatIndex];
    const next = row.seats[seatIndex + 1];

    return !!(current.listingId && current.listingId === next.listingId);
  };


  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
    >
      {/* Render connectors first (behind seats) */}
      {section.rows.map((row, rowIndex) =>
        row.seats.slice(0, seatsPerRow).map((seat, seatIndex) => {
          if (!hasConnector(rowIndex, seatIndex)) return null;

          const { cx, cy } = getSeatCenter(rowIndex, seatIndex);
          const nextCx = cx + SEAT_SIZE + SEAT_GAP;

          return (
            <line
              key={`connector-${seat.seatId}`}
              x1={cx}
              y1={cy}
              x2={nextCx}
              y2={cy}
              stroke={seatColors.connector}
              strokeWidth={connectorWidth}
            />
          );
        })
      )}

      {/* Render seats */}
      {section.rows.map((row, rowIndex) =>
        row.seats.slice(0, seatsPerRow).map((seat, seatIndex) => {
          const { cx, cy } = getSeatCenter(rowIndex, seatIndex);
          const isAvailable = isSeatAvailable(seat);

          return (
            <circle
              id={seat.seatId}
              key={seat.seatId}
              cx={cx}
              cy={cy}
              r={radius}
              fill={getSeatColor(seat)}
              style={{ transition: `fill ${hoverTransitionMs}ms ease-out` }}
              className={isAvailable ? 'cursor-pointer' : 'cursor-default'}
              onClick={() => handleClick(seat)}
              onMouseEnter={handleMouseEnter ? () => handleMouseEnter(seat) : undefined}
              onMouseLeave={handleMouseLeave}
              onMouseDown={() => handleMouseDown(seat)}
              onMouseUp={handleMouseUp}
            />
          );
        })
      )}
    </svg>
  );
}
