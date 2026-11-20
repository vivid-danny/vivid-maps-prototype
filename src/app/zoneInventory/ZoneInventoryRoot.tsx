import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventDetails } from '../components/chrome/EventDetails';
import { SiteHeader } from '../components/chrome/SiteHeader';
import { useLayoutMode } from '../seatMap/state/useLayoutMode';
import { ZONE_LISTINGS } from './data/listings';
import { buildPanelModel, lowestPriceByShape } from './logic/visibility';
import { PRICE_RANGES, ZoneFilters } from './components/ZoneFilters';
import { ZoneListingsPanel } from './components/ZoneListingsPanel';
import { ZoneVenueMap } from './components/ZoneVenueMap';
import type { EventInfo } from '../seatMap/model/types';
import type { Filters, SortBy, ZoneListing } from './types';

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

export function ZoneInventoryRoot() {
  const viewportMode = useLayoutMode();
  const [forceMobile, setForceMobile] = useState(false);
  const isMobile = forceMobile || viewportMode === 'mobile';

  // Hidden by default and toggled with Shift+H, matching the seat-map
  // prototype's controls panel.
  const [showStates, setShowStates] = useState(false);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
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
    () => buildPanelModel(ZONE_LISTINGS, selectedShapeIds, filters, sortBy),
    [selectedShapeIds, filters, sortBy],
  );

  const pinPrices = useMemo(() => lowestPriceByShape(ZONE_LISTINGS, filters), [filters]);

  const handleToggleShape = useCallback((shapeId: string, additive: boolean) => {
    setSelectedListingId(null);
    setSelectedShapeIds((current) => {
      if (!additive) return [shapeId];
      return current.includes(shapeId)
        ? current.filter((id) => id !== shapeId)
        : [...current, shapeId];
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedShapeIds([]);
    setSelectedListingId(null);
  }, []);

  const handleSelectListing = useCallback((listing: ZoneListing) => {
    setSelectedListingId(listing.listingId);
  }, []);

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
      sortBy={sortBy}
      onSortByChange={setSortBy}
    />
  );

  const map = (
    <ZoneVenueMap
      selectedShapeIds={selectedShapeIds}
      pinPrices={pinPrices}
      onToggleShape={handleToggleShape}
      onClearSelection={handleClearSelection}
      isMobile={isMobile}
    />
  );

  const content = isMobile ? (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="shrink-0 border-b border-line-thin">
        <EventDetails eventInfo={EVENT_INFO} variant="mobile" onBack={handleClearSelection} />
      </div>
      <div className="shrink-0" style={{ height: MOBILE_MAP_HEIGHT }}>
        {map}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white px-3 pt-3">
        <div className="shrink-0 pb-3">
          <ZoneFilters
            variant="mobile"
            filters={filters}
            priceRangeIndex={priceRangeIndex}
            onQuantityChange={setQuantity}
            onPriceRangeChange={setPriceRangeIndex}
          />
        </div>
        {panel}
      </div>
    </div>
  ) : (
    <div className="flex h-full w-full overflow-hidden">
      <div className="h-full shrink-0 p-4" style={{ width: '40%', maxWidth: '34rem' }}>
        <div className="flex h-full w-full flex-col gap-4 overflow-hidden rounded-lg bg-white p-4">
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
