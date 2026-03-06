import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  isAnimatingRef: MutableRefObject<boolean>;
}

export function useSeatMapPrototypeViewState({
  model,
  layoutMode,
  controller,
  currentScale,
  setCurrentScale,
  transformRef,
  isAnimatingRef,
}: UseSeatMapPrototypeViewStateParams) {
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER);
  const [showControls, setShowControls] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('listings');

  const listings = model.listings;
  const pendingZoomRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedListing = useMemo(() => {
    if (!selection.listingId) return null;
    return listings.find((l) => l.listingId === selection.listingId) || null;
  }, [listings, selection.listingId]);

  const listingsBySection = model.listingsBySection;
  const pinsBySection = model.pinsBySection;

  // Cleanup pending zoom on unmount
  useEffect(() => {
    return () => {
      if (pendingZoomRef.current) clearTimeout(pendingZoomRef.current);
    };
  }, []);

  useEffect(() => {
    // Cancel any pending step-2 zoom when layout resets
    if (pendingZoomRef.current) {
      clearTimeout(pendingZoomRef.current);
      pendingZoomRef.current = null;
    }

    const timeout = setTimeout(() => {
      transformRef.current?.centerView(controller.initialScale, 0);
      setSelection(EMPTY_SELECTION);
      setCurrentScale(controller.initialScale);
    }, 50);

    return () => clearTimeout(timeout);
  }, [controller.initialScale, layoutMode, setCurrentScale, transformRef]);

  const navigateToSelection = useCallback((sel: SelectionState) => {
    if (!sel.sectionId) return;

    // Signal that a programmatic zoom is in progress — SeatMapRoot will
    // defer display-mode switches until the animation settles
    isAnimatingRef.current = true;

    // Cancel any in-flight step-2 zoom
    if (pendingZoomRef.current) {
      clearTimeout(pendingZoomRef.current);
      pendingZoomRef.current = null;
    }

    // Determine the fine-grained target element (row or seat)
    let fineElementId: string | null = null;
    if (sel.seatIds.length > 0) {
      const midIndex = Math.floor(sel.seatIds.length / 2);
      fineElementId = sel.seatIds[midIndex];
    } else if (sel.rowId) {
      fineElementId = sel.rowId;
    }

    const targetScale = currentScale >= controller.zoomThreshold
      ? currentScale
      : controller.zoomThreshold + 0.5;

    const alreadyZoomedIn = currentScale >= controller.zoomThreshold;

    if (alreadyZoomedIn) {
      // Already zoomed in — row/seat elements are in the DOM, single-step zoom
      // Fall back through: seat → row → section (seats may lack DOM ids in real venue)
      const elementId = (fineElementId && document.getElementById(fineElementId))
        ? fineElementId
        : (sel.rowId && document.getElementById(sel.rowId))
          ? sel.rowId
          : `section-${sel.sectionId}`;
      transformRef.current?.zoomToElement(elementId, targetScale, 300, 'easeOut');
    } else {
      // Zoomed out — row/seat elements not in DOM yet.
      // Step 1: zoom to the section (always in DOM) to trigger display mode change
      transformRef.current?.zoomToElement(`section-${sel.sectionId}`, targetScale, 300, 'easeOut');

      // Step 2: after animation + re-render, refine to row/seat
      if (fineElementId || sel.rowId) {
        const candidateId = fineElementId ?? sel.rowId!;
        const fallbackRowId = sel.rowId;
        pendingZoomRef.current = setTimeout(() => {
          pendingZoomRef.current = null;
          const targetId = document.getElementById(candidateId)
            ? candidateId
            : fallbackRowId && document.getElementById(fallbackRowId)
              ? fallbackRowId
              : null;
          if (targetId) {
            transformRef.current?.zoomToElement(targetId, targetScale, 200, 'easeOut');
          }
        }, 400);
      }
    }
  }, [currentScale, controller.zoomThreshold, controller.initialScale, transformRef]);

  const handleSelect = useCallback((newSelection: SelectionState) => {
    const nextSelection = getToggledSelection(selection, newSelection);

    if (nextSelection === EMPTY_SELECTION) {
      setSelection(EMPTY_SELECTION);
      setViewMode('listings');
    } else {
      setSelection(nextSelection);
      navigateToSelection(nextSelection);
      setViewMode(nextSelection.listingId ? 'detail' : 'listings');
    }
  }, [selection, navigateToSelection]);

  const handleSelectFromPanel = useCallback((listing: Listing) => {
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
  }, [viewMode, selection, model.sectionDataById, layoutMode, navigateToSelection]);

  const handleBackToListings = useCallback(() => {
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
  }, [selection, model.sectionDataById]);

  const handleHoverFromPanel = useCallback((listing: Listing | null) => {
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
  }, [layoutMode]);

  const handleHoverFromMap = useCallback((hover: HoverState) => {
    if (layoutMode === 'mobile') return;
    setHoverState(hover);
  }, [layoutMode]);

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
