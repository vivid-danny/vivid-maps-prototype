import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { HoverState, Listing, SeatMapModel, SelectionState } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import type { SeatMapController } from './useSeatMapController';

interface UseSeatMapPrototypeViewStateParams {
  model: SeatMapModel;
  config: SeatMapConfig;
  controller: SeatMapController;
  currentScale: number;
  setCurrentScale: Dispatch<SetStateAction<number>>;
  transformRef: MutableRefObject<ReactZoomPanPinchRef | null>;
}

export function useSeatMapPrototypeViewState({
  model,
  config,
  controller,
  currentScale,
  setCurrentScale,
  transformRef,
}: UseSeatMapPrototypeViewStateParams) {
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION);
  const [hoverState, setHoverState] = useState<HoverState>(EMPTY_HOVER);
  const [showControls, setShowControls] = useState(true);

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
  }, [controller.initialScale, config.layoutMode, setCurrentScale, transformRef]);

  const navigateToSelection = (sel: SelectionState) => {
    if (!sel.sectionId) return;

    let elementId = `section-${sel.sectionId}`;
    if (controller.displayMode === 'seats' && sel.seatIds.length > 0) {
      const midIndex = Math.floor(sel.seatIds.length / 2);
      elementId = sel.seatIds[midIndex];
    } else if (controller.displayMode === 'rows' && sel.rowId) {
      elementId = sel.rowId;
    }

    const targetScale = currentScale >= controller.zoomThreshold
      ? currentScale
      : controller.zoomThreshold + 0.5;

    transformRef.current?.zoomToElement(elementId, targetScale, 300, 'easeOut');
  };

  const handleSelect = (newSelection: SelectionState) => {
    const isClickingSection = newSelection.sectionId && !newSelection.rowId && newSelection.seatIds.length === 0;
    const isClickingRow = newSelection.rowId && newSelection.seatIds.length === 0;
    const isClickingSeat = newSelection.seatIds.length > 0;

    let shouldDeselect = false;

    if (isClickingSeat) {
      shouldDeselect =
        selection.listingId === newSelection.listingId &&
        selection.seatIds.length === newSelection.seatIds.length &&
        selection.seatIds.every((id) => newSelection.seatIds.includes(id));
    } else if (isClickingRow) {
      shouldDeselect = selection.rowId === newSelection.rowId;
    } else if (isClickingSection) {
      shouldDeselect = selection.sectionId === newSelection.sectionId;
    }

    if (shouldDeselect) {
      setSelection(EMPTY_SELECTION);
    } else {
      setSelection(newSelection);
      navigateToSelection(newSelection);
    }
  };

  const handleSelectFromPanel = (listing: Listing) => {
    if (selection.listingId === listing.listingId) {
      setSelection(EMPTY_SELECTION);
      return;
    }

    const newSelection: SelectionState = {
      sectionId: listing.sectionId,
      rowId: listing.rowId,
      listingId: listing.listingId,
      seatIds: listing.seatIds,
    };

    setSelection(newSelection);
    navigateToSelection(newSelection);
  };

  const handleHoverFromPanel = (listing: Listing | null) => {
    if (config.layoutMode === 'mobile') return;
    if (listing) {
      setHoverState({
        listingId: listing.listingId,
        sectionId: listing.sectionId,
        rowId: listing.rowId,
      });
    } else {
      setHoverState(EMPTY_HOVER);
    }
  };

  const handleHoverFromMap = (hover: HoverState) => {
    if (config.layoutMode === 'mobile') return;
    setHoverState(hover);
  };

  return {
    selection,
    hoverState,
    currentScale,
    showControls,
    listings,
    selectedListing,
    listingsBySection,
    pinsBySection,
    setShowControls,
    setSelection,
    handleSelect,
    handleSelectFromPanel,
    handleHoverFromPanel,
    handleHoverFromMap,
  };
}
