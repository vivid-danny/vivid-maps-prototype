import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { HoverState, LayoutMode, Listing, PinData, SeatMapModel, SelectionState, ViewMode } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import type { SeatMapController } from './useSeatMapController';
import { clearHover, getToggledSelection } from '../behavior/rules';
import { ROW_ZOOM_MIN } from '../maplibre/constants';
import { deriveVisualSeatAssignments } from '../maplibre/deriveVisualSeatAssignments';

interface UseSeatMapPrototypeViewStateParams {
  model: SeatMapModel;
  layoutMode: LayoutMode;
  controller: SeatMapController;
  currentScale: number;
  setCurrentScale: Dispatch<SetStateAction<number>>;
  navigateFn: (sel: SelectionState, zoom?: number) => void;
}

export function useSeatMapPrototypeViewState({
  model,
  layoutMode,
  controller,
  currentScale,
  setCurrentScale,
  navigateFn,
}: UseSeatMapPrototypeViewStateParams) {
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER);
  const [showControls, setShowControls] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('listings');
  const [quantityFilter, setQuantityFilter] = useState<number>(2);

  const listings = useMemo(() => {
    return model.listings.filter(l => l.quantityAvailable >= quantityFilter);
  }, [model.listings, quantityFilter]);

  const visualSeatAssignments = useMemo(() => {
    const filteredListings = model.listings.filter((listing) => listing.quantityAvailable >= quantityFilter);
    const filteredListingsBySection = new Map<string, Listing[]>();
    for (const listing of filteredListings) {
      const existing = filteredListingsBySection.get(listing.sectionId);
      if (existing) {
        existing.push(listing);
      } else {
        filteredListingsBySection.set(listing.sectionId, [listing]);
      }
    }

    return deriveVisualSeatAssignments({
      ...model,
      listings: filteredListings,
      listingsBySection: filteredListingsBySection,
    });
  }, [model, quantityFilter]);

  const selectedListing = useMemo(() => {
    if (!selection.listingId) return null;
    return listings.find((l) => l.listingId === selection.listingId) || null;
  }, [listings, selection.listingId]);

  const listingsBySection = useMemo(() => {
    const map = new Map<string, Listing[]>();
    for (const l of listings) {
      const arr = map.get(l.sectionId);
      if (arr) arr.push(l);
      else map.set(l.sectionId, [l]);
    }
    return map;
  }, [listings]);

  const pinsBySection = useMemo(() => {
    const map = new Map<string, PinData[]>();
    for (const [sectionId, pins] of model.pinsBySection) {
      const filtered = pins.filter(p => p.listing.quantityAvailable >= quantityFilter);
      if (filtered.length > 0) map.set(sectionId, filtered);
    }
    return map;
  }, [model.pinsBySection, quantityFilter]);

  // Clear selected listing if it gets filtered out by quantity change
  useEffect(() => {
    if (selection.listingId && !listings.some(l => l.listingId === selection.listingId)) {
      setSelection(prev => ({ ...prev, listingId: null, seatIds: [] }));
      setViewMode('listings');
    }
  }, [listings, selection.listingId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSelection(EMPTY_SELECTION);
      setCurrentScale(ROW_ZOOM_MIN - 1);
    }, 50);

    return () => clearTimeout(timeout);
  }, [layoutMode, setCurrentScale]);

  const navigateToSelection = useCallback((sel: SelectionState) => {
    if (!sel.sectionId) return;
    navigateFn(sel);
  }, [navigateFn]);

  const handleSelect = useCallback((newSelection: SelectionState) => {
    let nextSelection = getToggledSelection(selection, newSelection);

    if (nextSelection === EMPTY_SELECTION) {
      setSelection(EMPTY_SELECTION);
      setViewMode('listings');
    } else {
      // Resolve listingId from seatIds when the map click doesn't know it
      if (!nextSelection.listingId && nextSelection.seatIds.length > 0) {
        const matchSeatId = nextSelection.seatIds.find((seatId) =>
          visualSeatAssignments.visualSeatListingBySeatId.has(seatId),
        );
        const match = matchSeatId
          ? visualSeatAssignments.visualSeatListingBySeatId.get(matchSeatId) ?? null
          : listings.find((l) =>
            nextSelection.seatIds.some((id) => l.seatIds.includes(id))
          ) ?? null;
        if (match) {
          nextSelection = {
            ...nextSelection,
            listingId: match.listingId,
            rowId: visualSeatAssignments.visualRowIdByListingId.get(match.listingId) ?? match.rowId,
            seatIds: visualSeatAssignments.visualSeatIdsByListingId.get(match.listingId) ?? match.seatIds,
          };
        }
      }
      setSelection(nextSelection);
      navigateToSelection(nextSelection);
      setViewMode(nextSelection.listingId ? 'detail' : 'listings');
    }
  }, [selection, navigateToSelection, listings]);

  const handleSelectFromPanel = useCallback((listing: Listing) => {
    // If already viewing this listing's detail, go back to listings
    if (viewMode === 'detail' && selection.listingId === listing.listingId) {
      setViewMode('listings');
      // Check if this listing is in a zone row — return to zone row selection
      const sectionData = model.sectionDataById.get(listing.sectionId);
      const row = listing.rowId ? sectionData?.rows.find(r => r.rowId === listing.rowId) : undefined;
      if (row?.isZoneRow) {
        setSelection({ sectionId: listing.sectionId, rowId: listing.rowId, listingId: null, seatIds: [] });
      } else {
        setSelection({ ...EMPTY_SELECTION, sectionId: selection.sectionId });
      }
      return;
    }

    const newSelection: SelectionState = {
      sectionId: listing.sectionId,
      rowId: visualSeatAssignments.visualRowIdByListingId.get(listing.listingId) ?? listing.rowId,
      listingId: listing.listingId,
      seatIds: visualSeatAssignments.visualSeatIdsByListingId.get(listing.listingId) ?? listing.seatIds,
    };

    setSelection(newSelection);
    setViewMode('detail');
    if (layoutMode !== 'mobile') {
      navigateToSelection(newSelection);
    }
  }, [viewMode, selection, model.sectionDataById, layoutMode, navigateToSelection, visualSeatAssignments]);

  const handleBackToListings = useCallback(() => {
    setViewMode('listings');
    // If current selection is in a zone row, return to row-level selection
    if (selection.rowId && selection.sectionId) {
      const sectionData = model.sectionDataById.get(selection.sectionId);
      const row = sectionData?.rows.find(r => r.rowId === selection.rowId);
      if (row?.isZoneRow) {
        setSelection({ sectionId: selection.sectionId, rowId: selection.rowId, listingId: null, seatIds: [] });
        navigateFn({ sectionId: selection.sectionId, rowId: null, listingId: null, seatIds: [] }, 16);
        return;
      }
    }
    setSelection({ ...EMPTY_SELECTION, sectionId: selection.sectionId });
    navigateFn({ sectionId: selection.sectionId, rowId: null, listingId: null, seatIds: [] }, 16);
  }, [selection, model.sectionDataById, navigateFn]);

  const handleHoverFromPanel = useCallback((listing: Listing | null) => {
    if (layoutMode === 'mobile') return;
    if (listing) {
      setHoverState({
        listingId: listing.listingId,
        sectionId: listing.sectionId,
        rowId: listing.rowId ?? null,
      });
    } else {
      setHoverState(clearHover());
    }
  }, [layoutMode]);

  const handleHoverFromMap = useCallback((hover: HoverState) => {
    if (layoutMode === 'mobile') return;
    setHoverState(hover);
  }, [layoutMode]);

  const clearSelectionState = useCallback(() => {
    setSelection(EMPTY_SELECTION);
    setHoverState(EMPTY_HOVER);
    setViewMode('listings');
  }, []);

  const resetViewState = useCallback(() => {
    clearSelectionState();
    setQuantityFilter(2);
  }, [clearSelectionState]);

  return {
    selection,
    hoverState,
    currentScale,
    showControls,
    viewMode,
    listings,
    selectedListing,
    listingsBySection,
    pinsBySection,
    quantityFilter,
    setQuantityFilter,
    setShowControls,
    setSelection,
    clearSelectionState,
    resetViewState,
    handleSelect,
    handleSelectFromPanel,
    handleBackToListings,
    handleHoverFromPanel,
    handleHoverFromMap,
  };
}
