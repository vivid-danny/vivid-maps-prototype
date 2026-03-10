import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import type { HoverState, LayoutMode, Listing, SeatMapModel, SelectionState, ViewMode } from '../model/types';
import { EMPTY_HOVER, EMPTY_SELECTION } from '../model/types';
import type { SeatMapController } from './useSeatMapController';
import { clearHover, getToggledSelection } from '../behavior/rules';
import type { VenueGeometry } from '../mock/createVenueSeatMapModel';
import { resolveSelectionCenter } from '../../components/realVenueHelpers';
import { CONTENT_PADDING } from '../components/MapContainer';

interface UseSeatMapPrototypeViewStateParams {
  model: SeatMapModel;
  layoutMode: LayoutMode;
  controller: SeatMapController;
  currentScale: number;
  setCurrentScale: Dispatch<SetStateAction<number>>;
  transformRef: MutableRefObject<ReactZoomPanPinchRef | null>;
  isAnimatingRef: MutableRefObject<boolean>;
  geometry: VenueGeometry;
}

export function useSeatMapPrototypeViewState({
  model,
  layoutMode,
  controller,
  currentScale,
  setCurrentScale,
  transformRef,
  isAnimatingRef,
  geometry,
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

    const ref = transformRef.current;
    if (!ref) return;

    // currentScale (React state) only updates on threshold crossings, so it reliably
    // tells us whether we're in zoomed-in mode. But for the actual target scale when
    // already zoomed in, read transformState.scale to preserve the user's real zoom
    // level (currentScale may be stale at the old threshold-crossing value).
    const alreadyZoomedIn = currentScale >= controller.zoomThreshold;
    const actualScale = ref.instance?.transformState?.scale ?? currentScale;
    const targetScale = alreadyZoomedIn ? actualScale : controller.zoomThreshold + 0.5;

    // Get wrapper dimensions (stable; not affected by zoom animation)
    const wrapper = ref.instance?.wrapperComponent;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperW = wrapperRect.width;
    const wrapperH = wrapperRect.height;

    // Convert venue coordinates to transform position (centers the point in the viewport)
    const toTransform = (x: number, y: number, scale: number) => ({
      posX: wrapperW / 2 - (x + CONTENT_PADDING) * scale,
      posY: wrapperH / 2 - (y + CONTENT_PADDING) * scale,
    });

    // Section center (step-1 target or single-step fallback)
    const boundary = geometry.sectionBoundaries.get(sel.sectionId);
    const sectionCenter = boundary
      ? { x: boundary.bx + boundary.bw / 2, y: boundary.by + boundary.bh / 2 }
      : null;

    // Fine-grained center (seat → row → section)
    const fineCenter = resolveSelectionCenter(sel, geometry);
    const hasFineTarget = sel.seatIds.length > 0 || !!sel.rowId;

    if (alreadyZoomedIn) {
      // Single step: zoom directly to fine target (or section center as fallback)
      const center = fineCenter ?? sectionCenter;
      if (!center) return;
      const { posX, posY } = toTransform(center.x, center.y, targetScale);
      ref.setTransform(posX, posY, targetScale, 300, 'easeOut');
    } else {
      // Step 1: zoom to section center to trigger display-mode change
      if (!sectionCenter) return;
      const { posX: posX1, posY: posY1 } = toTransform(sectionCenter.x, sectionCenter.y, targetScale);
      ref.setTransform(posX1, posY1, targetScale, 300, 'easeOut');

      // Step 2: refine to row/seat after animation + re-render settle
      if (hasFineTarget && fineCenter) {
        pendingZoomRef.current = setTimeout(() => {
          pendingZoomRef.current = null;
          const { posX: posX2, posY: posY2 } = toTransform(fineCenter.x, fineCenter.y, targetScale);
          transformRef.current?.setTransform(posX2, posY2, targetScale, 200, 'easeOut');
        }, 400);
      }
    }
  }, [currentScale, controller.zoomThreshold, transformRef, geometry]);

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
