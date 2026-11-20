import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventDetails } from '../components/chrome/EventDetails';
import { SiteHeader } from '../components/chrome/SiteHeader';
import { useLayoutMode } from '../seatMap/state/useLayoutMode';
import { ZONE_LISTINGS } from './data/listings';
import { buildPanelModel, zoneShapeIds } from './logic/visibility';
import { buildPins } from './logic/pins';
import { PRICE_RANGES, ZoneFilters } from './components/ZoneFilters';
import { ZoneListingsPanel } from './components/ZoneListingsPanel';
import { ZonePanel } from './components/ZonePanel';
import { ZoneVenueMap } from './components/ZoneVenueMap';
import { ZoneTicketDetail } from './components/ticketDetail/ZoneTicketDetail';
import type { EventInfo } from '../seatMap/model/types';
import type { Filters, SortBy, ZoneId, ZoneListing } from './types';

const EVENT_INFO: EventInfo = {
  eventName: 'Italy vs. Spain — UEFA Nations League',
  eventDate: 'Sat, Mar 21 2026 · 8:45 PM',
  venueName: 'Stadio Olimpico',
  venueAddress: 'Viale dei Gladiatori, Rome, RM 00135',
};

/** The seven states the prototype has to demonstrate. */
const DEMO_STATES: Array<{ id: string; label: string; shapeIds: string[] }> = [
  { id: 'none', label: 'No selection', shapeIds: [] },
  { id: 'many', label: 'Busy section (119)', shapeIds: ['119'] },
  { id: 'thin', label: 'Thin section (122)', shapeIds: ['122'] },
  { id: 'empty', label: 'Empty section (121)', shapeIds: ['121'] },
  { id: 'same-zone', label: 'Two in one zone', shapeIds: ['119', '122'] },
  { id: 'cross-zone', label: 'Two across zones', shapeIds: ['119', 'AL3'] },
  { id: 'split', label: 'Split section (VIP AU4)', shapeIds: ['AU4-VIP'] },
];

const MOBILE_MAP_HEIGHT = 300;

/** Mirrors the base prototype's detail animation states. */
type DetailPhase = 'closed' | 'entering' | 'open' | 'exiting';

export function ZoneInventoryRoot() {
  const viewportMode = useLayoutMode();
  const [forceMobile, setForceMobile] = useState(false);
  const isMobile = forceMobile || viewportMode === 'mobile';

  // Hidden by default and toggled with Shift+H, matching the seat-map
  // prototype's controls panel.
  const [showStates, setShowStates] = useState(false);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  /** Zones picked from the chips. A zone and a section are competing answers
   *  to "where", so selecting either clears the other. */
  const [pickedZoneIds, setPickedZoneIds] = useState<ZoneId[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<ZoneId | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('price');
  const [priceRangeIndex, setPriceRangeIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key === 'H') setShowStates((value) => !value);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filters: Filters = useMemo(() => {
    const range = PRICE_RANGES[priceRangeIndex]!;
    return { quantity, priceMin: range.min, priceMax: range.max };
  }, [quantity, priceRangeIndex]);

  const panelModel = useMemo(
    () => buildPanelModel(ZONE_LISTINGS, selectedShapeIds, filters, sortBy, pickedZoneIds),
    [selectedShapeIds, filters, sortBy, pickedZoneIds],
  );

  // The map draws one selection; a zone chip simply contributes all its shapes.
  const mapSelectedShapeIds = useMemo(
    () => (selectedShapeIds.length > 0 ? selectedShapeIds : zoneShapeIds(pickedZoneIds)),
    [selectedShapeIds, pickedZoneIds],
  );

  /**
   * What the pointer is currently pointing at, as shapes. A card lights up where
   * it is — its section, or its whole zone when the seller never named one. A
   * zone chip lights up the zone it names. Only one can be hovered at a time,
   * but they feed the same layers either way.
   */
  const hoverShapeIds = useMemo(() => {
    if (hoveredZoneId !== null) return zoneShapeIds([hoveredZoneId]);
    if (hoveredListingId === null) return [];
    const listing = ZONE_LISTINGS.find((l) => l.listingId === hoveredListingId);
    if (!listing) return [];
    if (listing.shapeId) return [listing.shapeId];
    return listing.zoneId ? zoneShapeIds([listing.zoneId]) : [];
  }, [hoveredZoneId, hoveredListingId]);

  /**
   * Zones the current highlight covers whole. These collapse to one pin: a
   * region-wide highlight wants one price for the region, not one per section.
   */
  const collapsedZoneIds = useMemo(() => {
    const zones = new Set<ZoneId>(pickedZoneIds);
    if (hoveredZoneId) zones.add(hoveredZoneId);
    if (hoveredListingId) {
      const listing = ZONE_LISTINGS.find((l) => l.listingId === hoveredListingId);
      // A hovered card with no section highlights its whole zone, so its pins
      // collapse the same way a hovered chip's do.
      if (listing && !listing.shapeId && listing.zoneId) zones.add(listing.zoneId);
    }
    return [...zones];
  }, [pickedZoneIds, hoveredZoneId, hoveredListingId]);

  const pins = useMemo(
    () => buildPins(ZONE_LISTINGS, filters, {
      selectedShapeIds,
      collapsedZoneIds,
      selectedListingId,
    }),
    [filters, selectedShapeIds, collapsedZoneIds, selectedListingId],
  );

  /** Sections multi-select the same way zone chips do: each click toggles. */
  const handleToggleShape = useCallback((shapeId: string) => {
    setSelectedListingId(null);
    setPickedZoneIds([]);
    setSelectedShapeIds((current) =>
      current.includes(shapeId)
        ? current.filter((id) => id !== shapeId)
        : [...current, shapeId],
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShapeIds([]);
    setPickedZoneIds([]);
    setSelectedListingId(null);
  }, []);

  const handleToggleZone = useCallback((zoneId: ZoneId) => {
    setSelectedListingId(null);
    setSelectedShapeIds([]);
    setPickedZoneIds((current) =>
      current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId],
    );
  }, []);

  /**
   * Picking a listing says where it is as well as opening it: the section when
   * the seller gave one, the whole zone when they didn't. Picking the same
   * listing again closes the detail, as the base prototype does.
   */
  const handleSelectListing = useCallback((listing: ZoneListing) => {
    setSelectedListingId((current) => (current === listing.listingId ? null : listing.listingId));
    if (listing.shapeId) {
      setSelectedShapeIds([listing.shapeId]);
      setPickedZoneIds([]);
    } else if (listing.zoneId) {
      setSelectedShapeIds([]);
      setPickedZoneIds([listing.zoneId]);
    }
  }, []);

  const handleHoverListing = useCallback((listing: ZoneListing | null) => {
    if (isMobile) return;
    setHoveredListingId(listing?.listingId ?? null);
  }, [isMobile]);

  const handleHoverZone = useCallback((zoneId: ZoneId | null) => {
    if (isMobile) return;
    setHoveredZoneId(zoneId);
  }, [isMobile]);

  // Narrowing to mobile mid-hover would otherwise strand the wash on the map,
  // since the handlers stop firing before they can clear themselves.
  useEffect(() => {
    if (!isMobile) return;
    setHoveredListingId(null);
    setHoveredZoneId(null);
  }, [isMobile]);

  /*
   * Detail open/close, mirroring the base prototype. `lastListingRef` keeps the
   * listing mounted through the exit animation, which would otherwise unmount
   * before `detailSlideOut` finishes.
   */
  const selectedListing = useMemo(
    () => ZONE_LISTINGS.find((l) => l.listingId === selectedListingId) ?? null,
    [selectedListingId],
  );
  const isDetailOpen = selectedListing !== null;
  const [detailPhase, setDetailPhase] = useState<DetailPhase>('closed');
  const lastListingRef = useRef<ZoneListing | null>(null);
  if (selectedListing) lastListingRef.current = selectedListing;

  useEffect(() => {
    if (isDetailOpen) {
      setDetailPhase('entering');
      return;
    }
    setDetailPhase((prev) => {
      if (prev === 'open') return 'exiting';
      if (prev === 'entering') return 'closed'; // interrupted mid-enter: instant close
      return prev;
    });
  }, [isDetailOpen]);

  const handleDetailAnimationEnd = (event: React.AnimationEvent) => {
    // `.detail-content`'s own animation bubbles; only react to this element's.
    if (event.target !== event.currentTarget) return;
    if (detailPhase === 'entering') setDetailPhase('open');
    if (detailPhase === 'exiting') setDetailPhase('closed');
  };

  const showDetailOverlay = detailPhase !== 'closed';
  const detailListing = selectedListing ?? lastListingRef.current;
  const detailShapeIds = useMemo(() => {
    if (!detailListing) return [];
    if (detailListing.shapeId) return [detailListing.shapeId];
    return detailListing.zoneId ? zoneShapeIds([detailListing.zoneId]) : [];
  }, [detailListing]);

  const detailOverlay = showDetailOverlay && detailListing && (
    <div
      className={`absolute inset-0 detail-panel--${detailPhase}`}
      onAnimationEnd={handleDetailAnimationEnd}
    >
      <div key={detailListing.listingId} className="detail-content h-full w-full">
        <ZoneTicketDetail
          className="h-full w-full"
          listing={detailListing}
          highlightShapeIds={detailShapeIds}
          eventInfo={EVENT_INFO}
          layoutMode={isMobile ? 'mobile' : 'desktop'}
          initialQuantity={quantity}
          onBack={() => setSelectedListingId(null)}
        />
      </div>
    </div>
  );

  const activeStateId = useMemo(() => {
    const key = [...selectedShapeIds].sort().join('|');
    return DEMO_STATES.find((state) => [...state.shapeIds].sort().join('|') === key)?.id ?? null;
  }, [selectedShapeIds]);

  const stateSwitcher = (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line-thin bg-white px-4 py-2">
      <span className="mr-1 text-caption font-bold uppercase tracking-[0.06em] text-ink-muted">
        States
      </span>
      {DEMO_STATES.map((state) => (
        <button
          key={state.id}
          type="button"
          onClick={() => {
            setSelectedShapeIds(state.shapeIds);
            setPickedZoneIds([]);
            setSelectedListingId(null);
          }}
          className={`rounded border px-2.5 py-1 text-caption transition-colors ${
            activeStateId === state.id
              ? 'border-[#312784] bg-[#312784] text-white'
              : 'border-line bg-white text-ink hover:bg-surface-50'
          }`}
        >
          {state.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setForceMobile((value) => !value)}
        className="ml-auto rounded border border-line bg-white px-2.5 py-1 text-caption text-ink transition-colors hover:bg-surface-50"
      >
        {forceMobile ? 'Desktop width' : 'Mobile width'}
      </button>
    </div>
  );

  const panel = (
    <ZoneListingsPanel
      className="min-h-0 w-full flex-1"
      model={panelModel}
      selectedListingId={selectedListingId}
      onSelectListing={handleSelectListing}
      onHoverListing={handleHoverListing}
      sortBy={sortBy}
      onSortByChange={setSortBy}
    />
  );

  const map = (
    <ZoneVenueMap
      selectedShapeIds={mapSelectedShapeIds}
      hoverShapeIds={hoverShapeIds}
      pins={pins}
      onToggleShape={handleToggleShape}
      onPickZone={handleToggleZone}
      onClearSelection={handleClearSelection}
      isMobile={isMobile}
    />
  );

  const content = isMobile ? (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-line-thin">
        <EventDetails eventInfo={EVENT_INFO} variant="mobile" onBack={handleClearSelection} />
      </div>
      <div className="shrink-0" style={{ height: MOBILE_MAP_HEIGHT }}>
        {map}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white px-3 pt-3">
        <div className="flex shrink-0 flex-col gap-3 pb-3">
          <ZoneFilters
            variant="mobile"
            filters={filters}
            priceRangeIndex={priceRangeIndex}
            onQuantityChange={setQuantity}
            onPriceRangeChange={setPriceRangeIndex}
          />
          <ZonePanel
            variant="mobile"
            selectedZoneIds={pickedZoneIds}
            onToggleZone={handleToggleZone}
            onHoverZone={handleHoverZone}
          />
        </div>
        {panel}
      </div>
      {/* Outside the listings column: on mobile the detail covers the map too. */}
      {detailOverlay && <div className="absolute inset-0 z-[60]">{detailOverlay}</div>}
    </div>
  ) : (
    <div className="flex h-full w-full overflow-hidden">
      <div className="h-full shrink-0 p-4" style={{ width: '40%', maxWidth: '34rem' }}>
        <div className="relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-lg bg-white p-4">
          <div className="flex shrink-0 flex-col gap-4">
            <EventDetails eventInfo={EVENT_INFO} variant="desktop" />
            <ZoneFilters
              filters={filters}
              priceRangeIndex={priceRangeIndex}
              onQuantityChange={setQuantity}
              onPriceRangeChange={setPriceRangeIndex}
            />
          </div>
          {panel}
          {detailOverlay}
        </div>
      </div>
      <div className="h-full shrink-0 py-4 pr-4">
        <div className="h-full overflow-hidden rounded-lg bg-white" style={{ width: 186 }}>
          <ZonePanel
            selectedZoneIds={pickedZoneIds}
            onToggleZone={handleToggleZone}
            onHoverZone={handleHoverZone}
          />
        </div>
      </div>
      <div className="h-full min-w-0 flex-1">{map}</div>
    </div>
  );

  return (
    <div className="flex size-full flex-col">
      {!isMobile && <SiteHeader />}
      {showStates && stateSwitcher}
      <div className="flex min-h-0 flex-1 justify-center bg-background">
        {forceMobile ? (
          <div className="h-full w-[390px] shrink-0 overflow-hidden border-x border-line bg-white">
            {content}
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
