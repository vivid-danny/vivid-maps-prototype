import { parseSeatId } from './utils';
import type { HoverState, RowData, SeatData, SectionData, SelectionState } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import { resolveInteractionState } from './visualState';

// Re-export InteractionState as SeatVisualState for backward compatibility
export type { InteractionState as SeatVisualState } from './visualState';

export interface SeatVisualStateInput {
  seat: SeatData;
  selectedListingId: string | null;
  pressedListingId: string | null;
  localHoveredListingId: string | null;
  externalHoveredListingId: string | null;
}

export function isSeatAvailable(seat: SeatData): boolean {
  return seat.status === 'available';
}

export function getSeatVisualState({
  seat,
  selectedListingId,
  pressedListingId,
  localHoveredListingId,
  externalHoveredListingId,
}: SeatVisualStateInput): SeatVisualState {
  if (!isSeatAvailable(seat)) return 'unavailable';

  const listingId = seat.listingId;
  if (!listingId) return 'available';

  return resolveInteractionState({
    isAvailable: true,
    isSelected: selectedListingId === listingId,
    isPressed: pressedListingId === listingId,
    isHovered: localHoveredListingId === listingId || externalHoveredListingId === listingId,
  });
}

export interface RowVisualStateInput {
  rowId: string;
  isAvailable: boolean;
  selectedRowId: string | null;
  pressedRowId: string | null;
  localHoveredRowId: string | null;
  externalHoveredRowId: string | null;
}

export function isRowAvailable(row: RowData): boolean {
  return row.seats.some((seat) => isSeatAvailable(seat));
}

export function getRowVisualState({
  rowId,
  isAvailable,
  selectedRowId,
  pressedRowId,
  localHoveredRowId,
  externalHoveredRowId,
}: RowVisualStateInput): SeatVisualState {
  if (!isAvailable) return 'unavailable';
  return resolveInteractionState({
    isAvailable: true,
    isSelected: selectedRowId === rowId,
    isPressed: pressedRowId === rowId,
    isHovered: localHoveredRowId === rowId || externalHoveredRowId === rowId,
  });
}

export interface SectionVisualStateInput {
  isAvailable: boolean;
  isSelected: boolean;
  isPressed: boolean;
  isHovered: boolean;
}

export type SectionLabelVisualState = 'default' | 'unavailable' | 'active';

export function isSectionAvailable(section: SectionData): boolean {
  return section.rows.some((row) => row.seats.some((seat) => isSeatAvailable(seat)));
}

export function getSectionVisualState({
  isAvailable,
  isSelected,
  isPressed,
  isHovered,
}: SectionVisualStateInput): SeatVisualState {
  return resolveInteractionState({ isAvailable, isSelected, isPressed, isHovered });
}

export function getSectionLabelVisualState({
  isAvailable,
  isSelected,
  isPressed,
  isHovered,
}: SectionVisualStateInput): SectionLabelVisualState {
  if (!isAvailable) return 'unavailable';
  if (isSelected || isPressed || isHovered) return 'active';
  return 'default';
}

export function buildSectionSelection(sectionId: string): SelectionState {
  return {
    sectionId,
    rowId: null,
    listingId: null,
    seatIds: [],
  };
}

export function buildRowSelection(sectionId: string, rowId: string): SelectionState {
  return {
    sectionId,
    rowId,
    listingId: null,
    seatIds: [],
  };
}

export function buildListingSelection(sectionId: string, listingId: string, seatIds: string[], rowId?: string): SelectionState {
  const derivedRowId = rowId ?? (seatIds.length > 0 ? (parseSeatId(seatIds[0])?.rowId ?? null) : null);

  return {
    sectionId,
    rowId: derivedRowId,
    listingId,
    seatIds,
  };
}

export function getToggledSelection(previous: SelectionState, next: SelectionState): SelectionState {
  const isClickingSection = !!next.sectionId && !next.rowId && next.seatIds.length === 0;
  const isClickingRow = !!next.rowId && next.seatIds.length === 0;
  const isClickingSeat = next.seatIds.length > 0;

  let shouldDeselect = false;

  if (isClickingSeat) {
    shouldDeselect =
      previous.listingId === next.listingId
      && previous.seatIds.length === next.seatIds.length
      && previous.seatIds.every((id) => next.seatIds.includes(id));
  } else if (isClickingRow) {
    shouldDeselect = previous.rowId === next.rowId;
  } else if (isClickingSection) {
    shouldDeselect = previous.sectionId === next.sectionId;
  }

  return shouldDeselect ? EMPTY_SELECTION : next;
}

export function buildSectionHover(sectionId: string): HoverState {
  return {
    listingId: null,
    sectionId,
    rowId: null,
  };
}

export function buildRowHover(sectionId: string, rowId: string): HoverState {
  return {
    listingId: null,
    sectionId,
    rowId,
  };
}

export function buildListingHover(sectionId: string, listingId: string): HoverState {
  return {
    listingId,
    sectionId,
    rowId: null,
  };
}

export function clearHover(): HoverState {
  return EMPTY_HOVER;
}
