import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { ListingsPanel } from '../../components/ListingsPanel';
import { SiteHeader } from '../../components/chrome/SiteHeader';
import { EventDetails } from '../../components/chrome/EventDetails';
import { FilterChips } from '../../components/chrome/FilterChips';
import { DateSelector } from '../../components/chrome/DateSelector';
import { ZonePanel } from '../../components/chrome/ZonePanel';
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

const MOBILE_MAP_HEIGHT = 190;

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
    ...(INITIAL_URL_PARAMS.showConnectors !== undefined ? { showConnectors: INITIAL_URL_PARAMS.showConnectors } : {}),
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
      showConnectors: config.showConnectors,
    });
  }, [config.initialDisplay, config.zoomedDisplay, config.theme, config.showConnectors]);

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

  const layoutMode = useLayoutMode();
  const isMobile = layoutMode === 'mobile';

  const navigateFn = useCallback((sel: SelectionState, zoom?: number) => {
    const map = mapInstanceRef.current;
    if (!map || !sel.sectionId) return;

    const entry = sectionCenters.get(sel.sectionId);
    if (!entry) return;

    // When initial and zoomed display are the same, pan only — no zoom change.
    const panOnly = config.initialDisplay === config.zoomedDisplay;

    if (sel.rowId) {
      const center = entry.rows[sel.rowId]?.center ?? entry.center;
      const defaultZoom = isMobile ? ROW_ZOOM_MIN : SEAT_ZOOM_MIN;
      const rawZoom = zoom ?? defaultZoom;
      const targetZoom = panOnly ? map.getZoom() : (isMobile ? Math.min(rawZoom, ROW_ZOOM_MIN) : rawZoom);
      map.easeTo({ center, zoom: targetZoom, duration: 500, essential: true });
    } else {
      const baseZoom = isMobile ? ROW_ZOOM_MIN : ROW_ZOOM_MIN + 2;
      const rawZoom = zoom ?? Math.max(baseZoom, map.getZoom());
      const targetZoom = panOnly ? map.getZoom() : (isMobile ? Math.min(rawZoom, ROW_ZOOM_MIN) : rawZoom);
      map.easeTo({ center: entry.center, zoom: targetZoom, duration: 500, essential: true });
    }
  }, [sectionCenters, config.initialDisplay, config.zoomedDisplay, isMobile]);

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
  const hasActiveSelection = !!(
    viewState.selection.sectionId
    || viewState.selection.rowId
    || viewState.selection.listingId
    || viewState.selection.seatIds.length > 0
  );

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

  useEffect(() => {
    mapInstanceRef.current?.resize();
  }, [isMobile]);

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
    <div className="size-full flex flex-col">
      {!isMobile && <SiteHeader />}

      <div className="flex-1 min-h-0 flex">
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
            <div className="h-full shrink-0 p-4" style={{ width: 480 }}>
              <div className="w-full h-full rounded-xl overflow-hidden shadow-sm relative flex flex-col bg-white">
                <div className="shrink-0 flex flex-col gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
                  <EventDetails eventInfo={model.eventInfo} variant="desktop" />
                  <FilterChips
                    quantityFilter={viewState.quantityFilter}
                    onQuantityFilterChange={viewState.setQuantityFilter}
                  />
                  <DateSelector />
                </div>
                <ListingsPanel
                  className="flex-1 min-h-0 w-full"
                  listings={viewState.listings}
                  selection={panelSelection}
                  hoverState={viewState.hoverState}
                  onSelectListing={viewState.handleSelectFromPanel}
                  onHoverListing={viewState.handleHoverFromPanel}
                  disableHover={isMobile}
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

          {/* Desktop: Filter by Zone panel */}
          {!isMobile && (
            <div className="h-full shrink-0 py-4 pr-4">
              <div
                className="h-full rounded-xl overflow-hidden shadow-sm bg-white"
                style={{ width: 186 }}
              >
                <ZonePanel variant="desktop" />
              </div>
            </div>
          )}

          {/* Mobile: event info header */}
          {isMobile && (
            <div className="border-b border-gray-200 shrink-0">
              <EventDetails eventInfo={model.eventInfo} variant="mobile" />
            </div>
          )}

          {/* Map area */}
          <div
            className={`flex items-center justify-center ${!isMobile ? 'flex-1 min-w-0 h-full' : 'shrink-0'}`}
            style={isMobile ? { height: MOBILE_MAP_HEIGHT } : undefined}
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
                  zoomedDisplay={config.zoomedDisplay}
                  showConnectors={config.showConnectors}
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
                {!isMobile && (
                  <>
                    <button
                      onClick={() => mapInstanceRef.current?.zoomIn()}
                      className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200/50 rounded-lg shadow-sm cursor-pointer transition-colors duration-100"
                      aria-label="Zoom in"
                    >
                      <Plus className="w-4 h-4 text-[#04092C]" />
                    </button>
                    <button
                      onClick={() => mapInstanceRef.current?.zoomOut()}
                      className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200/50 rounded-lg shadow-sm cursor-pointer transition-colors duration-100"
                      aria-label="Zoom out"
                    >
                      <Minus className="w-4 h-4 text-[#04092C]" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    const map = mapInstanceRef.current;
                    viewState.clearSelectionState();
                    setCurrentScale(ROW_ZOOM_MIN - 1);
                    if (map) {
                      isResettingRef.current = true;
                      map.fitBounds(VENUE_BOUNDS, {
                        padding: isMobile
                          ? { top: -20, bottom: -20, left: 0, right: 0 }
                          : 40,
                        bearing: -57, duration: 600, essential: true,
                      });
                      map.once('idle', () => {
                        isResettingRef.current = false;
                        setCurrentScale(map.getZoom());
                      });
                    }
                  }}
                  className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200/50 rounded-lg shadow-sm cursor-pointer transition-all duration-150"
                  style={{
                    opacity: hasActiveSelection ? 1 : 0,
                    pointerEvents: hasActiveSelection ? 'auto' : 'none',
                  }}
                  aria-label="Reset map"
                >
                  <RotateCcw className="w-4 h-4 text-[#04092C]" />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile: filters + zone chips + listings panel */}
          {isMobile && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
              <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 pb-2 border-b border-gray-100">
                <FilterChips
                  quantityFilter={viewState.quantityFilter}
                  onQuantityFilterChange={viewState.setQuantityFilter}
                />
                <ZonePanel variant="mobile" />
              </div>
              <div className="flex-1 min-h-0 relative overflow-hidden">
                <ListingsPanel
                  className="w-full h-full bg-white"
                  listings={viewState.listings}
                  selection={panelSelection}
                  hoverState={viewState.hoverState}
                  onSelectListing={viewState.handleSelectFromPanel}
                  onHoverListing={viewState.handleHoverFromPanel}
                  disableHover={isMobile}
                  onPolePosition={viewState.handlePolePosition}
                />
              </div>
            </div>
          )}

          {/* Mobile: detail overlay — covers full viewport (map + listings) */}
          {isMobile && showDetailOverlay && detailListing && (
            <div
              className={`absolute inset-0 z-[60] detail-panel--${detailPhase}`}
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
    </div>
  );
}
