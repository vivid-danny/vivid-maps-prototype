import { useState, useMemo } from 'react';
import type { SectionData, SeatColors, SeatData } from '../seatMap/model/types';
import { SEAT_SIZE, SEAT_GAP, ROW_GAP, PADDING, getSeatRowWidth, getSectionHeight, getSeatCenter } from './constants';
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
  // Zone row props
  selectedRowId?: string | null;
  onSelectZoneRow?: (rowId: string) => void;
  onZoneRowHover?: (rowId: string | null) => void;
  externalHoveredRowId?: string | null;
  zoneRowDisplay?: 'rows' | 'seats';
  listingColorOverrides?: Map<string, string> | null;
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
  selectedRowId = null,
  onSelectZoneRow,
  onZoneRowHover,
  externalHoveredRowId = null,
  zoneRowDisplay = 'rows',
  listingColorOverrides = null,
}: SeatsViewProps) {
  const [localHoveredListingId, setLocalHoveredListingId] = useState<string | null>(null);
  const [pressedListingId, setPressedListingId] = useState<string | null>(null);
  const hoverIntent = useHoverIntent<string | null>(onListingHover, null);

  // Zone row local state
  const [localHoveredZoneRowId, setLocalHoveredZoneRowId] = useState<string | null>(null);
  const [pressedZoneRowId, setPressedZoneRowId] = useState<string | null>(null);
  const zoneRowHoverIntent = useHoverIntent<string | null>(onZoneRowHover, null);

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

  // Build a map of zone row rowId -> set of listing IDs (for visual state checks)
  const zoneRowListingIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    section.rows.forEach((row) => {
      if (!row.isZoneRow) return;
      const ids = new Set<string>();
      row.seats.forEach((seat) => {
        if (seat.listingId) ids.add(seat.listingId);
      });
      map.set(row.rowId, ids);
    });
    return map;
  }, [section.rows]);

  // Zone row visual state: determines fill color
  const getZoneRowColor = (rowId: string): string => {
    const listingIds = zoneRowListingIds.get(rowId);

    // Selected: row is selected OR selectedListingId matches a zone listing
    const isSelected = selectedRowId === rowId ||
      (!!selectedListingId && !!listingIds && listingIds.has(selectedListingId));
    if (isSelected) return seatColors.selected;

    // Pressed
    if (pressedZoneRowId === rowId) return seatColors.pressed;

    // Hover: local hover, external row hover, or external listing hover matching zone
    const isHovered = localHoveredZoneRowId === rowId ||
      externalHoveredRowId === rowId ||
      (!!externalHoveredListingId && !!listingIds && listingIds.has(externalHoveredListingId));
    if (isHovered) return seatColors.hover;

    return seatColors.available;
  };

  // Zone row connector color — mirrors getZoneRowColor but uses connector palette
  const getZoneRowConnectorColor = (rowId: string): string => {
    const listingIds = zoneRowListingIds.get(rowId);

    const isSelected = selectedRowId === rowId ||
      (!!selectedListingId && !!listingIds && listingIds.has(selectedListingId));
    if (isSelected) return seatColors.connectorSelected;

    if (pressedZoneRowId === rowId) return seatColors.connectorPressed;

    const isHovered = localHoveredZoneRowId === rowId ||
      externalHoveredRowId === rowId ||
      (!!externalHoveredListingId && !!listingIds && listingIds.has(externalHoveredListingId));
    if (isHovered) return seatColors.connectorHover;

    return seatColors.connector;
  };

  const getListingOverrideColor = (listingId: string | undefined, fallback: string): string =>
    (listingColorOverrides && listingId && listingColorOverrides.get(listingId)) || fallback;

  const getConnectorColor = (seat: SeatData): string => {
    const state = getSeatVisualState({
      seat,
      selectedListingId,
      pressedListingId,
      localHoveredListingId,
      externalHoveredListingId,
    });
    switch (state) {
      case 'selected': return seatColors.connectorSelected;
      case 'pressed':  return seatColors.connectorPressed;
      case 'hover':    return seatColors.connectorHover;
      default:         return getListingOverrideColor(seat.listingId, seatColors.connector);
    }
  };

  const getSeatColor = (seat: SeatData): string => {
    const state = getSeatVisualState({
      seat,
      selectedListingId,
      pressedListingId,
      localHoveredListingId,
      externalHoveredListingId,
    });

    switch (state) {
      case 'unavailable': return seatColors.unavailable;
      case 'selected':    return seatColors.selected;
      case 'pressed':     return seatColors.pressed;
      case 'hover':       return seatColors.hover;
      case 'available':
      default:            return getListingOverrideColor(seat.listingId, seatColors.available);
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

  // Zone row dimensions (same as RowsView bars)
  const barWidth = width - PADDING * 2;
  const barHeight = SEAT_SIZE;
  const cornerRadius = barHeight / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
    >
      {/* Render connectors first (behind seats) — skip zone rows */}
      {section.rows.map((row, rowIndex) => {
        if (row.isZoneRow) return null;
        return row.seats.slice(0, seatsPerRow).map((seat, seatIndex) => {
          if (connectorWidth === 0 || !hasConnector(rowIndex, seatIndex)) return null;

          const { cx, cy } = getSeatCenter(rowIndex, seatIndex);

          return (
            <rect
              key={`connector-${seat.seatId}`}
              x={cx}
              y={cy - connectorWidth / 2}
              width={SEAT_SIZE + SEAT_GAP}
              height={connectorWidth}
              fill={getConnectorColor(seat)}
              style={{ transition: `fill ${hoverTransitionMs}ms ease-out` }}
              className="cursor-pointer"
              onClick={() => handleClick(seat)}
              onMouseEnter={handleMouseEnter ? () => handleMouseEnter(seat) : undefined}
              onMouseLeave={handleMouseLeave}
              onMouseDown={() => handleMouseDown(seat)}
              onMouseUp={handleMouseUp}
            />
          );
        });
      })}

      {/* Render individual seats — skip zone rows */}
      {section.rows.map((row, rowIndex) => {
        if (row.isZoneRow) return null;
        return row.seats.slice(0, seatsPerRow).map((seat, seatIndex) => {
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
        });
      })}

      {/* Render zone rows */}
      {section.rows.map((row, rowIndex) => {
        if (!row.isZoneRow) return null;

        const y = PADDING + rowIndex * (SEAT_SIZE + ROW_GAP);
        const transition = `fill ${hoverTransitionMs}ms ease-out`;

        const zoneRowHandlers = {
          onClick: onSelectZoneRow ? () => onSelectZoneRow(row.rowId) : undefined,
          onMouseEnter: onZoneRowHover ? () => {
            setLocalHoveredZoneRowId(row.rowId);
            zoneRowHoverIntent.enter(row.rowId);
          } : undefined,
          onMouseLeave: onZoneRowHover ? () => {
            setLocalHoveredZoneRowId(null);
            setPressedZoneRowId(null);
            zoneRowHoverIntent.leave();
          } : undefined,
          onMouseDown: () => setPressedZoneRowId(row.rowId),
          onMouseUp: () => setPressedZoneRowId(null),
        };

        if (zoneRowDisplay === 'seats') {
          return (
            <g
              id={row.rowId}
              key={`zone-${row.rowId}`}
              className="cursor-pointer"
              {...zoneRowHandlers}
            >
              {/* Connectors between adjacent seats */}
              {connectorWidth > 0 && Array.from({ length: seatsPerRow - 1 }, (_, seatIndex) => {
                const { cx } = getSeatCenter(rowIndex, seatIndex);
                const { cy } = getSeatCenter(rowIndex, seatIndex);
                return (
                  <rect
                    key={`zone-conn-${row.rowId}-${seatIndex}`}
                    x={cx}
                    y={cy - connectorWidth / 2}
                    width={SEAT_SIZE + SEAT_GAP}
                    height={connectorWidth}
                    fill={getZoneRowConnectorColor(row.rowId)}
                    style={{ transition }}
                  />
                );
              })}
              {/* Seat circles */}
              {Array.from({ length: seatsPerRow }, (_, seatIndex) => {
                const { cx, cy } = getSeatCenter(rowIndex, seatIndex);
                return (
                  <circle
                    key={`zone-seat-${row.rowId}-${seatIndex}`}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={getZoneRowColor(row.rowId)}
                    style={{ transition }}
                  />
                );
              })}
            </g>
          );
        }

        return (
          <rect
            id={row.rowId}
            key={`zone-${row.rowId}`}
            x={PADDING}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={cornerRadius}
            ry={cornerRadius}
            fill={getZoneRowColor(row.rowId)}
            style={{ transition }}
            className="cursor-pointer"
            {...zoneRowHandlers}
          />
        );
      })}
    </svg>
  );
}
