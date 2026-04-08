import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { ListingsPanel } from '../../components/ListingsPanel';
import { TicketDetail } from '../../components/ticketDetail/TicketDetail';
import { createDefaultSeatMapConfig } from '../config/defaults';
import { getDealColor, getZoneColor, THEMES } from '../config/themes';
import { useSeatMapConfig } from '../state/useSeatMapConfig';
import { MAP_REGISTRY } from '../mock/mapRegistry';
import { clearUrlParams, INITIAL_URL_PARAMS, syncToUrl } from '../state/useUrlParams';
import { useSeatMapController } from '../state/useSeatMapController';
import { useVenueManifest } from '../maplibre/useVenueManifest';
import { ROW_ZOOM_MIN, SEAT_ZOOM_MIN, VENUE_BOUNDS } from '../maplibre/constants';
import { useSeatMapPrototypeViewState } from '../state/useSeatMapPrototypeViewState';
import { useLayoutMode } from '../state/useLayoutMode';
import { PrototypeControls } from './PrototypeControls';
import { EMPTY_SELECTION } from '../model/types';
import type { Listing, SeatColors, SelectionState } from '../model/types';

type DetailPhase = 'closed' | 'entering' | 'open' | 'exiting';

const LazyMapLibreVenue = lazy(async () => {
  const mod = await import('../../components/MapLibreVenue');
  return { default: mod.MapLibreVenue };
});

export function SeatMapRoot() {
  const mapDef = MAP_REGISTRY[0]!;

  const mapInstanceRef = useRef<MaplibreMap | null>(null);
  const isResettingRef = useRef(false);

  const venueModel = useMemo(() => mapDef.createModel(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { seatableIds, sectionCenters } = useVenueManifest(mapDef.assets.manifestUrl);
  const model = venueModel;
  const defaultConfig = useMemo(() => createDefaultSeatMapConfig(), []);
  const startupConfig = useMemo(() => ({
    ...createDefaultSeatMapConfig(),
    ...(INITIAL_URL_PARAMS.initialDisplay ? { initialDisplay: INITIAL_URL_PARAMS.initialDisplay } : {}),
    ...(INITIAL_URL_PARAMS.zoomedDisplay ? { zoomedDisplay: INITIAL_URL_PARAMS.zoomedDisplay } : {}),
    ...(INITIAL_URL_PARAMS.theme ? { theme: INITIAL_URL_PARAMS.theme, seatColors: THEMES[INITIAL_URL_PARAMS.theme] } : {}),
  }), []);
  const { config, updateConfig, resetConfig: rawResetConfig } = useSeatMapConfig({
    initialConfig: startupConfig,
    resetConfig: defaultConfig,
  });
  const [currentScale, setCurrentScale] = useState(ROW_ZOOM_MIN - 1);
  const [displayZoom, setDisplayZoom] = useState(ROW_ZOOM_MIN - 1);
  const [controlsResetVersion, setControlsResetVersion] = useState(0);

  const resetConfig = useCallback(() => {
    rawResetConfig();
  }, [rawResetConfig]);

  // Sync URL params live
  useEffect(() => {
    syncToUrl({
      initialDisplay: config.initialDisplay,
      zoomedDisplay: config.zoomedDisplay,
      theme: config.theme,
    });
  }, [config.initialDisplay, config.zoomedDisplay, config.theme]);

  const handleMapReady = useCallback((map: MaplibreMap) => {
    mapInstanceRef.current = map;
  }, []);

  // Only propagate zoom to React state when crossing ROW_ZOOM_MIN — avoids
  // re-rendering SeatMapRoot (and all children) on every scroll/pinch frame.
  // Suppressed during reset animation to prevent intermediate zoom levels from
  // briefly flipping displayMode back to rows/seats and flashing extra pins.
  const handleZoomChange = useCallback((zoom: number) => {
    if (isResettingRef.current) return;
    setDisplayZoom(zoom);
    setCurrentScale(prev => {
      if ((prev >= ROW_ZOOM_MIN) !== (zoom >= ROW_ZOOM_MIN)) return zoom;
      return prev; // same zone — bail out, no re-render
    });
  }, []);

  const navigateFn = useCallback((sel: SelectionState, zoom?: number) => {
    const map = mapInstanceRef.current;
    if (!map || !sel.sectionId) return;

    const entry = sectionCenters.get(sel.sectionId);
    if (!entry) return;

    // When initial and zoomed display are the same, pan only — no zoom change.
    const panOnly = config.initialDisplay === config.zoomedDisplay;

    if (sel.rowId) {
      const center = entry.rows[sel.rowId]?.center ?? entry.center;
      const targetZoom = panOnly ? map.getZoom() : (zoom ?? SEAT_ZOOM_MIN);
      map.easeTo({ center, zoom: targetZoom, duration: 500, essential: true });
    } else {
      const baseZoom = ROW_ZOOM_MIN + 2;
      const targetZoom = panOnly ? map.getZoom() : (zoom ?? Math.max(baseZoom, map.getZoom()));
      map.easeTo({ center: entry.center, zoom: targetZoom, duration: 500, essential: true });
    }
  }, [sectionCenters, config.initialDisplay, config.zoomedDisplay]);


  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === 'mobile';

  const controller = useSeatMapController({
    model,
    config,
    layoutMode,
    currentScale,
  });

  const viewState = useSeatMapPrototypeViewState({
    model,
    layoutMode,
    controller,
    currentScale,
    setCurrentScale,
    navigateFn,
  });
  const { resetViewState } = viewState;

  const handleResetAll = useCallback(() => {
    resetConfig();
    resetViewState();
    clearUrlParams();
    setControlsResetVersion((prev) => prev + 1);
  }, [resetConfig, resetViewState]);

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
    ? { ...panelSelectionRef.current, listingId: viewState.selection.listingId }
    : viewState.selection;

  const mapFallback = (
    <div
      className="size-full"
      style={{ backgroundColor: config.mapBackground }}
      aria-label="Loading venue map"
    />
  );

  return (
    <div className="size-full flex">
      <PrototypeControls
        showControls={viewState.showControls}
        currentScale={displayZoom}
        displayMode={controller.displayMode}
        config={config}
        resetVersion={controlsResetVersion}
        onConfigChange={updateConfig}
        onResetConfig={handleResetAll}
      />

      <div
        className="flex-1 min-w-0 flex"
        style={{ backgroundColor: config.mapBackground }}
      >
        <div
          className={`flex ${
            isMobile
              ? 'flex-col bg-white w-full h-full overflow-hidden relative'
              : 'flex-row w-full h-full overflow-hidden'
          }`}
        >
          {/* Desktop: sidebar panel (listings + detail overlay) */}
          {!isMobile && (
            <div className="h-full shrink-0 p-4" style={{ width: 482 }}>
              <div className="w-full h-full rounded-xl overflow-hidden shadow-sm relative">
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
                  quantityFilter={viewState.quantityFilter}
                  onQuantityFilterChange={viewState.setQuantityFilter}
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
                        initialQuantity={viewState.quantityFilter}
                        onBack={viewState.handleBackToListings}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile: event info header */}
          {isMobile && (
            <div className="px-4 py-3 flex items-center gap-3 bg-white border-b border-gray-200 shrink-0">
              <div className="w-12 h-12 rounded-lg bg-[#0e3386] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 text-sm leading-tight">Chicago Cubs vs St. Louis Cardinals</div>
                <div className="text-xs text-gray-500 mt-0.5">Wrigley Field · Chicago, IL</div>
                <div className="text-xs text-gray-500">Wed, Apr 9 at 7:05 PM</div>
              </div>
            </div>
          )}

          {/* Map area */}
          <div
            className={`flex items-center justify-center ${!isMobile ? 'flex-1 min-w-0 h-full' : 'shrink-0'}`}
            style={isMobile ? { height: 200 } : undefined}
          >
            <div className="relative w-full h-full">
              <Suspense fallback={mapFallback}>
                <LazyMapLibreVenue
                  seatColors={config.seatColors}
                  model={venueModel}
                  theme={config.theme}
                  displayMode={controller.displayMode}
                  seatableIds={seatableIds}
                  sectionCenters={sectionCenters}
                  assets={mapDef.assets}
                  selection={viewState.selection}
                  selectedListing={viewState.selectedListing}
                  hoverState={viewState.hoverState}
                  onSelect={viewState.handleSelect}
                  onHover={viewState.handleHoverFromMap}
                  isMobile={isMobile}
                  pinDensity={config.pinDensity}
                  venueFill={config.venueFill}
                  venueStroke={config.venueStroke}
                  sectionStroke={config.sectionStroke}
                  mapBackground={config.mapBackground}
                  sectionBase={config.sectionBase}
                  rowStrokeColor={config.rowStrokeColor}
                  rowFillColor={config.rowFillColor}
                  overlays={config.overlays}
                  onZoomChange={handleZoomChange}
                  onMapReady={handleMapReady}
                  filteredListingsBySection={viewState.listingsBySection}
                  filteredPinsBySection={viewState.pinsBySection}
                />
              </Suspense>
              <div className="absolute top-4 left-4 z-[40] flex gap-2">
                <button
                  onClick={() => mapInstanceRef.current?.zoomIn()}
                  className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 active:bg-gray-200 rounded shadow-sm cursor-pointer"
                  aria-label="Zoom in"
                >
                  <Plus className="w-4 h-4 text-[#04092C]" />
                </button>
                <button
                  onClick={() => mapInstanceRef.current?.zoomOut()}
                  className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 active:bg-gray-200 rounded shadow-sm cursor-pointer"
                  aria-label="Zoom out"
                >
                  <Minus className="w-4 h-4 text-[#04092C]" />
                </button>
                <button
                  onClick={() => {
                    const map = mapInstanceRef.current;
                    viewState.setSelection(EMPTY_SELECTION);
                    // Immediately drop displayMode to sections so pins switch before the animation runs.
                    setCurrentScale(ROW_ZOOM_MIN - 1);
                    if (map) {
                      isResettingRef.current = true;
                      map.fitBounds(VENUE_BOUNDS, { padding: isMobile ? 20 : 40, bearing: -57, duration: 600, essential: true });
                      map.once('idle', () => {
                        isResettingRef.current = false;
                        setCurrentScale(map.getZoom());
                      });
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-100 active:bg-gray-200 rounded shadow-sm cursor-pointer transition-opacity duration-200"
                  style={{
                    opacity: viewState.currentScale >= ROW_ZOOM_MIN ? 1 : 0,
                    pointerEvents: viewState.currentScale >= ROW_ZOOM_MIN ? 'auto' : 'none',
                  }}
                  aria-label="Reset map"
                >
                  <RotateCcw className="w-4 h-4 text-[#04092C]" />
                </button>
              </div>
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
                quantityFilter={viewState.quantityFilter}
                onQuantityFilterChange={viewState.setQuantityFilter}
                showEventInfo={false}
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
                  initialQuantity={viewState.quantityFilter}
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
