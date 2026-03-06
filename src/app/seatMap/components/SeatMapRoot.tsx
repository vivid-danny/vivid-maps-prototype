import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { RotateCcw } from 'lucide-react';
import { RealVenue, computeVisibleSections } from '../../components/RealVenue';
import type { ViewportRect } from '../../components/RealVenue';
import { ListingsPanel } from '../../components/ListingsPanel';
import { TicketDetail } from '../../components/ticketDetail/TicketDetail';
import { DEFAULT_SEAT_MAP_CONFIG } from '../config/defaults';
import { getDealColor, getZoneColor } from '../config/themes';
import { useSeatMapConfig } from '../state/useSeatMapConfig';
import { createVenueSeatMapModel } from '../mock/createVenueSeatMapModel';
import { useSeatMapController } from '../state/useSeatMapController';
import { useSeatMapPrototypeViewState } from '../state/useSeatMapPrototypeViewState';
import { useLayoutMode } from '../state/useLayoutMode';
import { PrototypeControls } from './PrototypeControls';
import { MapContainer } from './MapContainer';
import type { TransformState } from './MapContainer';
import { EMPTY_SELECTION } from '../model/types';
import type { Listing, SeatColors, SelectionState } from '../model/types';

type DetailPhase = 'closed' | 'entering' | 'open' | 'exiting';

const REAL_VENUE_SCALE_DEFAULTS = {
  desktopInitialScale: 0.12,
  desktopZoomThreshold: 0.3,
  mobileInitialScale: 0.03,
  mobileZoomThreshold: 0.15,
};

export function SeatMapRoot() {
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const prevSizeRef = useRef<{ width: number; height: number } | null>(null);
  const isAnimatingRef = useRef(false);
  const isGestureActiveRef = useRef(false);
  const pendingScaleRef = useRef<number | null>(null);
  const currentScaleForThresholdRef = useRef(REAL_VENUE_SCALE_DEFAULTS.desktopInitialScale);

  const venueModel = useMemo(() => createVenueSeatMapModel(), []);
  const model = venueModel;
  const { config, updateConfig, resetConfig: rawResetConfig } = useSeatMapConfig({
    ...DEFAULT_SEAT_MAP_CONFIG,
    ...REAL_VENUE_SCALE_DEFAULTS,
  });
  const [currentScale, setCurrentScale] = useState(REAL_VENUE_SCALE_DEFAULTS.desktopInitialScale);

  const resetConfig = useCallback(() => {
    rawResetConfig();
    updateConfig(REAL_VENUE_SCALE_DEFAULTS);
  }, [rawResetConfig, updateConfig]);

  // Viewport rect in venue coordinates — updated during pan/zoom via rAF
  // Only triggers re-render when the set of visible sections changes
  const [viewportRect, setViewportRect] = useState<ViewportRect | null>(null);
  const wrapperSizeRef = useRef<{ w: number; h: number } | null>(null);
  const lastVisibleRef = useRef<Set<string> | null>(null);

  const handleTransformChange = useCallback((state: TransformState) => {
    if (!wrapperSizeRef.current) {
      const wrapper = transformRef.current?.instance?.wrapperComponent;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        wrapperSizeRef.current = { w: rect.width, h: rect.height };
      }
    }
    const ws = wrapperSizeRef.current;
    if (!ws) return;

    const newRect: ViewportRect = {
      x: -state.positionX / state.scale,
      y: -state.positionY / state.scale,
      w: ws.w / state.scale,
      h: ws.h / state.scale,
    };

    // Reuse RealVenue's culling logic (applies CULL_PADDING on section side)
    const newVisible = computeVisibleSections(venueModel.geometry, newRect);
    const prev = lastVisibleRef.current;

    // Only update React state if the visible section set changed
    let changed = !prev || !newVisible;
    if (!changed && prev && newVisible) {
      if (prev.size !== newVisible.size) {
        changed = true;
      } else {
        for (const id of newVisible) {
          if (!prev.has(id)) { changed = true; break; }
        }
      }
    }

    if (changed) {
      setViewportRect(newRect);
      lastVisibleRef.current = newVisible;
    }
  }, [venueModel.geometry]);

  const layoutMode = useLayoutMode(config.layoutModeOverride);
  const isSimulatedMobile = config.layoutModeOverride === 'mobile';
  const isMobile = layoutMode === 'mobile';

  const controller = useSeatMapController({
    model,
    config,
    layoutMode,
    currentScale,
  });

  // Gate setCurrentScale to threshold crossings only — avoids 60fps re-renders during zoom.
  // The CSS var --map-scale (set by MapContainer) handles visual pin scaling without React.
  // During programmatic zoom animations AND manual gestures (scroll-wheel, pinch), defer the
  // threshold crossing to avoid mounting ~18K SVG elements mid-gesture (causes choppy frames).
  // Uses a ref instead of currentScale state to avoid stale closures during rapid scrolling.
  const handleScaleChange = useCallback((scale: number) => {
    isGestureActiveRef.current = true;
    const threshold = controller.zoomThreshold;
    const wasAbove = currentScaleForThresholdRef.current >= threshold;
    currentScaleForThresholdRef.current = scale;
    const nowAbove = scale >= threshold;
    if (wasAbove !== nowAbove) {
      if (isAnimatingRef.current || isGestureActiveRef.current) {
        pendingScaleRef.current = scale;
      } else {
        setCurrentScale(scale);
      }
    }
  }, [controller.zoomThreshold]);

  // Called by MapContainer when gestures/animations settle — flush any deferred scale update
  const flushPendingScale = useCallback(() => {
    isAnimatingRef.current = false;
    isGestureActiveRef.current = false;
    if (pendingScaleRef.current !== null) {
      const pending = pendingScaleRef.current;
      pendingScaleRef.current = null;
      setCurrentScale(pending);
    }
    // Always recalculate viewport after any animation or gesture settles
    const state = transformRef.current?.instance?.transformState;
    if (state) handleTransformChange(state as TransformState);
  }, [handleTransformChange, transformRef]);

  const viewState = useSeatMapPrototypeViewState({
    model,
    layoutMode,
    controller,
    currentScale,
    setCurrentScale,
    transformRef,
    isAnimatingRef,
  });

  // For zone/deal themes: build per-section SeatColors with overridden available/connector
  const seatColorsBySection = useMemo(() => {
    if (config.theme !== 'zone' && config.theme !== 'deal') return null;
    const map = new Map<string, SeatColors>();
    for (const section of model.sections) {
      if (config.theme === 'zone' && section.zone) {
        const zoneColor = getZoneColor(section.zone);
        map.set(section.sectionId, {
          ...config.seatColors,
          available: zoneColor,
          connector: zoneColor,
        });
      } else if (config.theme === 'deal') {
        const sectionListings = model.listingsBySection.get(section.sectionId);
        if (sectionListings && sectionListings.length > 0) {
          const cheapest = sectionListings.reduce((a, b) => a.price <= b.price ? a : b);
          const dealColor = getDealColor(cheapest.dealScore);
          map.set(section.sectionId, {
            ...config.seatColors,
            available: dealColor,
            connector: dealColor,
          });
        }
      }
    }
    return map;
  }, [config.theme, config.seatColors, model.sections, model.listingsBySection]);

  // For deal theme: build per-listing color overrides (listingId → deal color)
  const dealColorOverrides = useMemo(() => {
    if (config.theme !== 'deal') return null;
    const map = new Map<string, string>();
    for (const listing of model.listings) {
      map.set(listing.listingId, getDealColor(listing.dealScore));
    }
    return map;
  }, [config.theme, model.listings]);

  useEffect(() => {
    if (isMobile) return;
    const el = mapContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;

      const prev = prevSizeRef.current;
      if (prev) {
        const dx = (rect.width - prev.width) / 2;
        const dy = (rect.height - prev.height) / 2;
        const state = transformRef.current?.instance?.transformState;
        if (state) {
          transformRef.current?.setTransform(
            state.positionX + dx,
            state.positionY + dy,
            state.scale,
            0, // instant
          );
        }
      }

      prevSizeRef.current = { width: rect.width, height: rect.height };
      // Invalidate cached wrapper size so viewport culling recalculates
      wrapperSizeRef.current = null;
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, transformRef]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'H') {
        viewState.setShowControls((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState.setShowControls]);

  // --- Detail panel slide transition ---
  const isDetailOpen = viewState.viewMode === 'detail' && !!viewState.selectedListing;
  const [detailPhase, setDetailPhase] = useState<DetailPhase>('closed');
  const lastListingRef = useRef<Listing | null>(null);

  if (viewState.selectedListing) {
    lastListingRef.current = viewState.selectedListing;
  }

  useEffect(() => {
    if (isDetailOpen) {
      setDetailPhase('entering');
    } else {
      setDetailPhase((prev) => {
        if (prev === 'open') return 'exiting';
        if (prev === 'entering') return 'closed'; // interrupted mid-enter: instant close
        return prev;
      });
    }
  }, [isDetailOpen]);

  const handleDetailAnimationEnd = (e: React.AnimationEvent) => {
    if (e.target !== e.currentTarget) return; // block bubbled events from inner content
    if (detailPhase === 'entering') setDetailPhase('open');
    if (detailPhase === 'exiting') setDetailPhase('closed');
  };

  const showDetailOverlay = detailPhase !== 'closed';
  const detailListing = viewState.selectedListing || lastListingRef.current;

  // Freeze panel selection during detail entry to prevent flash
  const panelSelectionRef = useRef<SelectionState>(viewState.selection);
  if (!isDetailOpen) {
    panelSelectionRef.current = viewState.selection;
  }
  const panelSelection = isDetailOpen
    ? panelSelectionRef.current
    : viewState.selection;

  return (
    <div className="size-full flex">
      <PrototypeControls
        showControls={viewState.showControls}
        currentScale={viewState.currentScale}
        displayMode={controller.displayMode}
        config={config}
        onConfigChange={updateConfig}
        onResetConfig={resetConfig}
      />

      <div
        className={`flex-1 min-w-0 flex ${
          isSimulatedMobile ? 'items-center justify-center p-5' : ''
        }`}
        style={{ backgroundColor: '#f3f4f6' }}
      >
        <div
          className={`flex bg-white ${
            isSimulatedMobile
              ? 'w-[390px] flex-col h-[812px] overflow-hidden border border-gray-300 relative'
              : isMobile
              ? 'flex-col w-full h-full overflow-hidden relative'
              : 'flex-row w-full h-full overflow-hidden'
          }`}
        >
          {/* Desktop: sidebar panel (listings + detail overlay) */}
          {!isMobile && (
            <div className="w-[450px] h-full shrink-0 relative overflow-hidden">
              <ListingsPanel
                className="w-full h-full"
                listings={viewState.listings}
                selection={panelSelection}
                hoverState={viewState.hoverState}
                onSelectListing={viewState.handleSelectFromPanel}
                onHoverListing={viewState.handleHoverFromPanel}
                selectedColor={config.seatColors.selected}
                hoverColor={config.seatColors.hover}
                pressedColor={config.seatColors.pressed}
                disableHover={isMobile}
                listingCardSize={config.listingCardSize}
              />
              {showDetailOverlay && detailListing && (
                <div
                  className={`absolute inset-0 detail-panel--${detailPhase}`}
                  onAnimationEnd={handleDetailAnimationEnd}
                >
                  <div
                    key={detailListing.listingId}
                    className="detail-content w-full h-full"
                  >
                    <TicketDetail
                      className="w-full h-full"
                      listing={detailListing}
                      eventInfo={model.eventInfo}
                      layoutMode={layoutMode}
                      onBack={viewState.handleBackToListings}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map area */}
          <div
            className={`flex items-center justify-center ${!isMobile ? 'flex-1 min-w-0 h-full' : 'shrink-0'}`}
            style={isMobile ? { height: config.mobileMapHeight } : undefined}
          >
            <div ref={mapContainerRef} className={`relative ${!isMobile ? 'w-full h-full' : ''}`}>
              <MapContainer
                ref={transformRef}
                controller={controller}
                isSimulatedMobile={isSimulatedMobile}
                mobileMapHeight={config.mobileMapHeight}
                onScaleChange={handleScaleChange}
                onAnimationSettle={flushPendingScale}
                onTransformChange={handleTransformChange}
                wheelStep={0.05}
                background={config.seatColors.mapBackground}
              >
                <RealVenue
                  model={venueModel}
                  seatColors={config.seatColors}
                  seatColorsBySection={seatColorsBySection}
                  displayMode={controller.displayMode}
                  selection={viewState.selection}
                  onSelect={viewState.handleSelect}
                  hoverState={viewState.hoverState}
                  onHover={viewState.handleHoverFromMap}
                  viewportRect={viewportRect}
                  pinsBySection={viewState.pinsBySection}
                  pinDensity={config.pinDensity}
                  connectorWidth={config.connectorWidth}
                  sectionStrokeWidth={config.sectionStrokeWidth}
                  selectedListing={viewState.selectedListing}
                  listingsBySection={viewState.listingsBySection}
                  dealColorOverrides={dealColorOverrides}
                  zoneRowDisplay={config.zoneRowDisplay}
                />
              </MapContainer>
              <button
                onClick={() => {
                  transformRef.current?.centerView(controller.initialScale, 300, 'easeOut');
                  viewState.setSelection(EMPTY_SELECTION);
                  currentScaleForThresholdRef.current = controller.initialScale;
                  setCurrentScale(controller.initialScale);
                }}
                className="absolute top-2 left-2 flex items-center gap-2 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-700 text-sm font-medium rounded shadow-sm cursor-pointer transition-opacity duration-200"
                style={{
                  padding: '6px 8px',
                  opacity: viewState.currentScale >= controller.zoomThreshold ? 1 : 0,
                  pointerEvents: viewState.currentScale >= controller.zoomThreshold ? 'auto' : 'none',
                }}
              >
                Reset Map <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile: listings panel */}
          {isMobile && (
            <div className="flex-1 relative overflow-hidden">
              <ListingsPanel
                className="w-full h-full"
                listings={viewState.listings}
                selection={panelSelection}
                hoverState={viewState.hoverState}
                onSelectListing={viewState.handleSelectFromPanel}
                onHoverListing={viewState.handleHoverFromPanel}
                selectedColor={config.seatColors.selected}
                hoverColor={config.seatColors.hover}
                pressedColor={config.seatColors.pressed}
                disableHover={isMobile}
                listingCardSize={config.listingCardSize}
              />
            </div>
          )}

          {/* Mobile: detail overlay — covers full viewport (map + listings) */}
          {isMobile && showDetailOverlay && detailListing && (
            <div
              className={`absolute inset-0 z-10 detail-panel--${detailPhase}`}
              onAnimationEnd={handleDetailAnimationEnd}
            >
              <div
                key={detailListing.listingId}
                className="detail-content w-full h-full"
              >
                <TicketDetail
                  className="w-full h-full"
                  listing={detailListing}
                  eventInfo={model.eventInfo}
                  layoutMode={layoutMode}
                  onBack={viewState.handleBackToListings}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
