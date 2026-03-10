import { parseSeatId } from './utils';
import type { HoverState, SelectionState } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';

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
