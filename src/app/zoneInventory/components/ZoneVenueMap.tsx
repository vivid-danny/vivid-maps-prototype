import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MaplibreMap, Marker } from 'maplibre-gl';
import { RotateCcw } from 'lucide-react';
import { Icon } from '../../components/chrome/Icon';
import {
  computeCollisionHiddenPins,
  DEFAULT_MIN_PIXEL_DISTANCE,
  MOBILE_MIN_PIXEL_DISTANCE,
} from '../../seatMap/behavior/pinCollision';
import { GLYPHS_URL } from '../../seatMap/maplibre/constants';
import {
  NO_ZONE_COLOR,
  SHAPE_BY_ID,
  VENUE,
  VENUE_BOUNDS,
  ZONE_COLOR_MATCH_PAIRS,
  labelsGeoJson,
  pitchGeoJson,
  sectionsGeoJson,
  shapeCenter,
  toLngLat,
} from '../data/venue';
import { zoneSiblingShapeIds } from '../logic/visibility';

const COLORS = {
  background: '#EFEFF6',
  pitchFill: '#FFFFFF',
  pitchLine: '#D3D3DC',
  sectionHoverFill: '#F7B4DF',
  sectionHoverOutline: '#CE3197',
  sectionOutline: '#D3D3DC',
  /** Selection overrides the zone color outright: primary-main fill, primary-dark ring. */
  selectedFill: '#CE3197',
  selectedOutline: '#8F1564',
  label: 'rgba(4, 9, 44, 0.55)',
  labelOnSelected: '#FFFFFF',
};

/** White veils laid over the pink fill to push unrelated geometry back. */
const ZONE_VEIL = 'rgba(255, 255, 255, 0.55)';
const OUTSIDE_VEIL = 'rgba(255, 255, 255, 0.82)';

/** Per-zone section fill. Shapes with no matched zone fall back to grey. */
const ZONE_FILL_COLOR = [
  'match',
  ['get', 'zoneId'],
  ...ZONE_COLOR_MATCH_PAIRS,
  NO_ZONE_COLOR,
] as unknown as maplibregl.DataDrivenPropertyValueSpecification<maplibregl.ColorSpecification>;

const EMPTY_FILTER: maplibregl.FilterSpecification = ['in', ['get', 'shapeId'], ['literal', []]];

function inShapes(ids: string[]): maplibregl.FilterSpecification {
  return ['in', ['get', 'shapeId'], ['literal', ids]];
}

function notInShapes(ids: string[]): maplibregl.FilterSpecification {
  return ['!', ['in', ['get', 'shapeId'], ['literal', ids]]];
}

function formatPinPrice(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

interface ZoneVenueMapProps {
  selectedShapeIds: string[];
  /** Lowest exact-section price per shape. A shape absent here gets no pin. */
  pinPrices: Map<string, number>;
  onToggleShape: (shapeId: string, additive: boolean) => void;
  onClearSelection: () => void;
  isMobile: boolean;
}

export function ZoneVenueMap({
  selectedShapeIds,
  pinPrices,
  onToggleShape,
  onClearSelection,
  isMobile,
}: ZoneVenueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  /** Per-pin data the collision pass needs, refreshed with the markers. */
  const pinMetaRef = useRef<Map<string, { price: number; isSelected: boolean; isMuted: boolean }>>(
    new Map(),
  );
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  /**
   * `ready` re-runs the paint effects; `readyRef` is what they actually trust.
   * The ref is cleared synchronously when a new map is built, so effects in the
   * same commit as a remount can't touch a style that is still loading — and it
   * is not `map.isStyleLoaded()`, which momentarily goes false while a
   * setFilter call is being digested.
   */
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [hasMovedView, setHasMovedView] = useState(false);
  /**
   * Hover is desktop-only and loses to selection: a selected section keeps its
   * ring rather than flipping to the hover wash, matching the base prototype's
   * selected > hover priority.
   */
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);

  // Handlers live in a ref so the map's own listeners never need rebinding.
  const handlersRef = useRef({ onToggleShape, onClearSelection });
  handlersRef.current = { onToggleShape, onClearSelection };

  const siblingShapeIds = useMemo(
    () => zoneSiblingShapeIds(selectedShapeIds),
    [selectedShapeIds],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    // A remount hands the paint effects a brand-new style; they must wait for it.
    readyRef.current = false;
    setReady(false);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: GLYPHS_URL,
        sources: {
          pitch: { type: 'geojson', data: pitchGeoJson() },
          sections: { type: 'geojson', data: sectionsGeoJson() },
          'section-labels': { type: 'geojson', data: labelsGeoJson() },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': COLORS.background },
          },
          {
            id: 'pitch-fill',
            type: 'fill',
            source: 'pitch',
            filter: ['==', ['get', 'kind'], 'pitch'],
            paint: { 'fill-color': COLORS.pitchFill },
          },
          {
            id: 'pitch-outline',
            type: 'line',
            source: 'pitch',
            filter: ['==', ['get', 'kind'], 'pitch'],
            paint: { 'line-color': COLORS.pitchLine, 'line-width': 1.5 },
          },
          {
            id: 'pitch-markings',
            type: 'line',
            source: 'pitch',
            filter: ['==', ['get', 'kind'], 'markings'],
            paint: { 'line-color': COLORS.pitchLine, 'line-width': 1 },
          },
          {
            id: 'section-fill',
            type: 'fill',
            source: 'sections',
            paint: { 'fill-color': ZONE_FILL_COLOR },
          },
          // Zone siblings keep a lighter pink: this is where Group 2 comes from.
          {
            id: 'section-zone-veil',
            type: 'fill',
            source: 'sections',
            filter: EMPTY_FILTER,
            paint: { 'fill-color': ZONE_VEIL },
          },
          // Everything outside the touched zones recedes.
          {
            id: 'section-outside-veil',
            type: 'fill',
            source: 'sections',
            filter: EMPTY_FILTER,
            paint: { 'fill-color': OUTSIDE_VEIL },
          },
          // Sits above the veils: a hovered section reveals through the recede
          // rather than staying muted, matching the base prototype's hover reveal.
          {
            id: 'section-hover-fill',
            type: 'fill',
            source: 'sections',
            filter: EMPTY_FILTER,
            paint: { 'fill-color': COLORS.sectionHoverFill },
          },
          // Above the hover wash: a selected section reads as selected, not as
          // its zone, so the fill is replaced rather than merely ringed.
          {
            id: 'section-selected-fill',
            type: 'fill',
            source: 'sections',
            filter: EMPTY_FILTER,
            paint: { 'fill-color': COLORS.selectedFill },
          },
          {
            id: 'section-outline',
            type: 'line',
            source: 'sections',
            paint: { 'line-color': COLORS.sectionOutline, 'line-width': 1 },
          },
          {
            id: 'section-hover-outline',
            type: 'line',
            source: 'sections',
            filter: EMPTY_FILTER,
            layout: { 'line-join': 'round' },
            paint: { 'line-color': COLORS.sectionHoverOutline, 'line-width': 2 },
          },
          {
            id: 'section-selected-outline',
            type: 'line',
            source: 'sections',
            filter: EMPTY_FILTER,
            layout: { 'line-join': 'round' },
            paint: {
              'line-color': COLORS.selectedOutline,
              'line-width': 3,
            },
          },
          {
            id: 'section-label',
            type: 'symbol',
            source: 'section-labels',
            layout: {
              'text-field': ['get', 'sectionLabel'],
              'text-font': ['GTWalsh Bold'],
              'text-size': 10,
              'text-offset': [0, 1.1],
              'text-allow-overlap': true,
              'text-padding': 0,
            },
            paint: { 'text-color': COLORS.labelOnSelected },
          },
        ],
      },
      bounds: VENUE_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchZoomRotate: true,
      maxZoom: 17,
    });

    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    map.on('click', 'section-fill', (event) => {
      event.preventDefault();
      const shapeId = event.features?.[0]?.properties?.shapeId as string | undefined;
      if (!shapeId) return;
      const original = event.originalEvent;
      handlersRef.current.onToggleShape(shapeId, original.shiftKey || original.metaKey);
    });

    map.on('click', (event) => {
      if (event.defaultPrevented) return;
      handlersRef.current.onClearSelection();
    });

    map.on('mouseenter', 'section-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    // mousemove, not mouseenter: moving between two adjacent shapes never
    // leaves the layer, so mouseenter alone would stick on the first one.
    map.on('mousemove', 'section-fill', (event) => {
      if (isMobileRef.current) return;
      const shapeId = event.features?.[0]?.properties?.shapeId as string | undefined;
      setHoveredShapeId(shapeId ?? null);
    });
    map.on('mouseleave', 'section-fill', () => {
      map.getCanvas().style.cursor = '';
      setHoveredShapeId(null);
    });

    map.on('moveend', (event) => {
      // `originalEvent` is present only for drag/scroll/pinch, not our fitBounds.
      if (event.originalEvent) setHasMovedView(true);
    });

    map.on('load', () => {
      readyRef.current = true;
      setReady(true);
    });

    return () => {
      readyRef.current = false;
      setReady(false);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Selection is a pure repaint — the view never moves, because zones can sit
  // at opposite ends of the plan and auto-zooming would hide half of Group 2.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const hasSelection = selectedShapeIds.length > 0;
    const inZone = [...selectedShapeIds, ...siblingShapeIds];
    // Selection outranks hover, so a selected shape never takes the wash.
    const hovered =
      hoveredShapeId && !selectedShapeIds.includes(hoveredShapeId) ? [hoveredShapeId] : [];

    map.setFilter('section-selected-fill', hasSelection ? inShapes(selectedShapeIds) : EMPTY_FILTER);
    map.setFilter('section-selected-outline', hasSelection ? inShapes(selectedShapeIds) : EMPTY_FILTER);
    map.setFilter('section-zone-veil', hasSelection ? inShapes(siblingShapeIds) : EMPTY_FILTER);
    map.setFilter('section-outside-veil', hasSelection ? notInShapes(inZone) : EMPTY_FILTER);
    map.setFilter('section-hover-fill', hovered.length ? inShapes(hovered) : EMPTY_FILTER);
    map.setFilter('section-hover-outline', hovered.length ? inShapes(hovered) : EMPTY_FILTER);

    /*
     * Label contrast has to follow whatever is actually under the text:
     * the pale hover wash and the outside-zone veil both need dark type, while
     * a full-strength zone fill needs white.
     */
    const labelColor = [
      'case',
      ['in', ['get', 'shapeId'], ['literal', hovered]],
      COLORS.label,
      ...(hasSelection
        ? [['in', ['get', 'shapeId'], ['literal', inZone]], COLORS.labelOnSelected, COLORS.label]
        : [COLORS.labelOnSelected]),
    ] as unknown as maplibregl.DataDrivenPropertyValueSpecification<maplibregl.ColorSpecification>;
    map.setPaintProperty('section-label', 'text-color', labelColor);
  }, [ready, selectedShapeIds, siblingShapeIds, pinPrices, hoveredShapeId]);

  // Switching layout changes the container's aspect ratio, so the venue has to
  // be re-fitted or the plan ends up cropped at mobile width.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.resize();
    map.fitBounds(VENUE_BOUNDS, { padding: isMobile ? 10 : 24, duration: 0 });
  }, [ready, isMobile]);

  /**
   * Decide which pins actually render. Two reasons to drop one: at mobile width
   * the pins outside the touched zones are noise, and anywhere a pin that lands
   * on top of a cheaper one has to give way. Re-run on every view change,
   * because zooming changes which pins overlap.
   */
  const refreshPinVisibility = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const compact = isMobileRef.current;

    const candidates = [...markersRef.current.entries()].flatMap(([shapeId, marker]) => {
      const meta = pinMetaRef.current.get(shapeId);
      if (!meta) return [];
      if (compact && meta.isMuted) {
        marker.getElement().hidden = true;
        return [];
      }
      const point = map.project(marker.getLngLat());
      return [{
        id: shapeId,
        screenX: point.x,
        screenY: point.y,
        isSelected: meta.isSelected,
        isHovered: false,
        dealScore: 0,
        price: meta.price,
      }];
    });

    const hidden = computeCollisionHiddenPins(
      candidates,
      compact ? MOBILE_MIN_PIXEL_DISTANCE : DEFAULT_MIN_PIXEL_DISTANCE,
    );
    for (const candidate of candidates) {
      const marker = markersRef.current.get(candidate.id);
      if (marker) marker.getElement().hidden = hidden.has(candidate.id);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on('move', refreshPinVisibility);
    map.on('zoom', refreshPinVisibility);
    return () => {
      map.off('move', refreshPinVisibility);
      map.off('zoom', refreshPinVisibility);
    };
  }, [ready, refreshPinVisibility]);

  // Price pins: one per section that has at least one exact-section listing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const selected = new Set(selectedShapeIds);
    const inZone = new Set([...selectedShapeIds, ...siblingShapeIds]);
    const hasSelection = selectedShapeIds.length > 0;
    const markers = markersRef.current;

    for (const [shapeId, marker] of markers) {
      if (!pinPrices.has(shapeId)) {
        marker.remove();
        markers.delete(shapeId);
      }
    }

    for (const [shapeId, price] of pinPrices) {
      const shape = SHAPE_BY_ID.get(shapeId);
      if (!shape) continue;

      let marker = markers.get(shapeId);
      if (!marker) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'zi-pin';
        const body = document.createElement('span');
        body.className = 'zi-pin__body';
        const priceEl = document.createElement('span');
        priceEl.className = 'zi-pin__price';
        const tail = document.createElement('span');
        tail.className = 'zi-pin__tail';
        body.append(priceEl, tail);
        element.append(body);
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          handlersRef.current.onToggleShape(shapeId, event.shiftKey || event.metaKey);
        });
        const [cx, cy] = shapeCenter(shape);
        // 'bottom' puts the tail tip on the section centre, as in the base prototype.
        marker = new maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat(toLngLat(cx, cy))
          .addTo(map);
        markers.set(shapeId, marker);
      }

      const element = marker.getElement();
      element.querySelector('.zi-pin__price')!.textContent = formatPinPrice(price);
      const state = selected.has(shapeId)
        ? 'selected'
        : hasSelection && !inZone.has(shapeId)
          ? 'muted'
          : 'default';
      element.dataset.state = state;
      // Selected pins sit above their neighbours, as in the base prototype.
      element.style.zIndex = state === 'selected' ? '20' : '10';
      element.setAttribute(
        'aria-label',
        `Section ${shape.sectionLabel}, from ${formatPinPrice(price)}`,
      );
      pinMetaRef.current.set(shapeId, {
        price,
        isSelected: state === 'selected',
        isMuted: state === 'muted',
      });
    }

    for (const shapeId of [...pinMetaRef.current.keys()]) {
      if (!markers.has(shapeId)) pinMetaRef.current.delete(shapeId);
    }

    refreshPinVisibility();
  }, [ready, pinPrices, selectedShapeIds, siblingShapeIds, isMobile, refreshPinVisibility]);

  /** Reset clears the selection and refits, matching the base prototype. */
  const resetView = useCallback(() => {
    handlersRef.current.onClearSelection();
    mapRef.current?.fitBounds(VENUE_BOUNDS, { padding: isMobile ? 10 : 24, duration: 600 });
    setHasMovedView(false);
  }, [isMobile]);

  // Reset only earns its place once the view is no longer the one we fitted, or
  // the buyer has selected something.
  const showReset = hasMovedView || selectedShapeIds.length > 0;

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" />
      <div
        className={`absolute z-10 flex items-center gap-2 ${
          isMobile ? 'bottom-2 right-2' : 'left-4 top-4'
        }`}
      >
        {!isMobile && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => {
                mapRef.current?.zoomIn();
                setHasMovedView(true);
              }}
              aria-label="Zoom in"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-l border-y border-l border-line-thin bg-white transition-colors duration-100 hover:bg-gray-50 active:bg-gray-100"
            >
              <Icon name="plus" />
            </button>
            <button
              type="button"
              onClick={() => {
                mapRef.current?.zoomOut();
                setHasMovedView(true);
              }}
              aria-label="Zoom out"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-r border border-line-thin bg-white transition-colors duration-100 hover:bg-gray-50 active:bg-gray-100"
            >
              <Icon name="minus" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset map"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-line-thin bg-white transition-all duration-150 hover:bg-gray-50 active:bg-gray-100"
          style={{
            opacity: showReset ? 1 : 0,
            pointerEvents: showReset ? 'auto' : 'none',
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 text-ink" />
        </button>
      </div>
      {!isMobile && (
        <p className="pointer-events-none absolute bottom-3 left-4 z-10 text-caption text-ink-muted">
          {VENUE.shapes.length} sections · shift-click to select more than one
        </p>
      )}
    </div>
  );
}
