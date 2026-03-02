import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { HoverState, LayoutMode, Listing, SeatMapModel, SelectionState, ViewMode } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import type { SeatMapController } from './useSeatMapController';
import { clearHover, getToggledSelection } from '../behavior/rules';

interface UseSeatMapPrototypeViewStateParams {
  model: SeatMapModel;
  layoutMode: LayoutMode;
  controller: SeatMapController;
  currentScale: number;
  setCurrentScale: Dispatch<SetStateAction<number>>;
  transformRef: MutableRefObject<ReactZoomPanPinchRef | null>;
}

export function useSeatMapPrototypeViewState({
  model,
  layoutMode,
  controller,
  currentScale,
  setCurrentScale,
  transformRef,
}: UseSeatMapPrototypeViewStateParams) {
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER);
  const [showControls, setShowControls] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('listings');

  const listings = model.listings;

  const selectedListing = useMemo(() => {
    if (!selection.listingId) return null;
    return listings.find((l) => l.listingId === selection.listingId) || null;
  }, [listings, selection.listingId]);

  const listingsBySection = model.listingsBySection;
  const pinsBySection = model.pinsBySection;

  useEffect(() => {
    const timeout = setTimeout(() => {
      transformRef.current?.centerView(controller.initialScale, 0);
      setSelection(EMPTY_SELECTION);
      setCurrentScale(controller.initialScale);
    }, 50);

    return () => clearTimeout(timeout);
  }, [controller.initialScale, layoutMode, setCurrentScale, transformRef]);

  const navigateToSelection = (sel: SelectionState) => {
    if (!sel.sectionId) return;

    let elementId = `section-${sel.sectionId}`;
    if (controller.displayMode === 'seats' && sel.seatIds.length > 0) {
      const midIndex = Math.floor(sel.seatIds.length / 2);
      elementId = sel.seatIds[midIndex];
    } else if (sel.rowId) {
      // Works for rows mode AND zone row selection in seats mode
      elementId = sel.rowId;
    }

    const targetScale = currentScale >= controller.zoomThreshold
      ? currentScale
      : controller.zoomThreshold + 0.5;

    transformRef.current?.zoomToElement(elementId, targetScale, 300, 'easeOut');
  };

  const handleSelect = (newSelection: SelectionState) => {
    const nextSelection = getToggledSelection(selection, newSelection);

    if (nextSelection === EMPTY_SELECTION) {
      setSelection(EMPTY_SELECTION);
      setViewMode('listings');
    } else {
      setSelection(nextSelection);
      navigateToSelection(nextSelection);
      setViewMode(nextSelection.listingId ? 'detail' : 'listings');
    }
  };

  const handleSelectFromPanel = (listing: Listing) => {
    // If already viewing this listing's detail, go back to listings
    if (viewMode === 'detail' && selection.listingId === listing.listingId) {
      setViewMode('listings');
      // Check if this listing is in a zone row — return to zone row selection
      const sectionData = model.sectionDataById.get(listing.sectionId);
      const row = sectionData?.rows.find(r => r.rowId === listing.rowId);
      if (row?.isZoneRow) {
        setSelection({ sectionId: listing.sectionId, rowId: listing.rowId, listingId: null, seatIds: [] });
      } else {
        setSelection({ ...EMPTY_SELECTION, sectionId: selection.sectionId });
      }
      return;
    }

    const newSelection: SelectionState = {
      sectionId: listing.sectionId,
      rowId: listing.rowId,
      listingId: listing.listingId,
      seatIds: listing.seatIds,
    };

    setSelection(newSelection);
    setViewMode('detail');
    if (layoutMode !== 'mobile') {
      navigateToSelection(newSelection);
    }
  };

  const handleBackToListings = () => {
    setViewMode('listings');
    // If current selection is in a zone row, return to row-level selection
    if (selection.rowId && selection.sectionId) {
      const sectionData = model.sectionDataById.get(selection.sectionId);
      const row = sectionData?.rows.find(r => r.rowId === selection.rowId);
      if (row?.isZoneRow) {
        setSelection({ sectionId: selection.sectionId, rowId: selection.rowId, listingId: null, seatIds: [] });
        return;
      }
    }
    setSelection({ ...EMPTY_SELECTION, sectionId: selection.sectionId });
  };

  const handleHoverFromPanel = (listing: Listing | null) => {
    if (layoutMode === 'mobile') return;
    if (listing) {
      setHoverState({
        listingId: listing.listingId,
        sectionId: listing.sectionId,
        rowId: listing.rowId,
      });
    } else {
      setHoverState(clearHover());
    }
  };

  const handleHoverFromMap = (hover: HoverState) => {
    if (layoutMode === 'mobile') return;
    setHoverState(hover);
  };

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
    setShowControls,
    setSelection,
    handleSelect,
    handleSelectFromPanel,
    handleBackToListings,
    handleHoverFromPanel,
    handleHoverFromMap,
  };
}
