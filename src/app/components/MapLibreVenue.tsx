import { useEffect, useMemo, useRef } from 'react';
import { useMapLibre } from '../seatMap/maplibre/useMapLibre';
import { createVenueStyle } from '../seatMap/maplibre/createStyle';
import { useFeatureState } from '../seatMap/maplibre/useFeatureState';
import { useMapInteractions } from '../seatMap/maplibre/useMapInteractions';
import { useMapSelectionSync } from '../seatMap/maplibre/useMapSelectionSync';
import { useMapPins } from '../seatMap/maplibre/useMapPins';
import { buildSectionFillExpression } from '../seatMap/maplibre/paintExpressions';
import {
  LAYER_ROW_FILL,
  LAYER_SEAT,
  LAYER_SECTION_FILL,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_STROKE,
  VENUE_BOUNDS,
} from '../seatMap/maplibre/constants';
import type { SeatColors, DisplayMode, SelectionState, HoverState, Listing } from '../seatMap/model/types';
import type { SeatMapModel } from '../seatMap/model/types';
import type { ThemeId } from '../seatMap/config/themes';
import type { VenueAssets } from '../seatMap/maplibre/types';
import type { SectionManifestEntry } from '../seatMap/maplibre/useVenueManifest';

interface MapLibreVenueProps {
  seatColors: SeatColors;
  model: SeatMapModel;
  theme: ThemeId;
  displayMode: DisplayMode;
  seatableIds: string[];
  sectionCenters: Map<string, SectionManifestEntry>;
  assets: VenueAssets;
  selection: SelectionState;
  selectedListing: Listing | null;
  hoverState: HoverState;
  onSelect: (selection: SelectionState) => void;
  onHover: (hover: HoverState) => void;
  isMobile: boolean;
  onZoomChange?: (zoom: number) => void;
}

type Visibility = 'visible' | 'none';

function setLayerVisibility(
  map: ReturnType<typeof useMapLibre>['mapRef']['current'],
  layerId: string,
  v: Visibility,
) {
  if (!map) return;
  map.setLayoutProperty(layerId, 'visibility', v);
}

export function MapLibreVenue({
  seatColors,
  model,
  theme,
  displayMode,
  seatableIds,
  sectionCenters,
  assets,
  selection,
  selectedListing,
  hoverState,
  onSelect,
  onHover,
  isMobile,
  onZoomChange,
}: MapLibreVenueProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const style = useMemo(
    () => createVenueStyle({ seatColors, assets }),
    // Recreates when venue assets change (venue switch); paint properties updated imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets],
  );

  const { mapRef, zoom, ready } = useMapLibre({
    containerRef,
    style,
    bounds: VENUE_BOUNDS,
  });

  // Wire inventory feature states (available/unavailable)
  useFeatureState({ mapRef, ready, model });

  // Wire click/hover event handlers on map layers
  useMapInteractions({ mapRef, ready, onSelect, onHover, isMobile });

  // Sync React selection/hover state → MapLibre feature state
  useMapSelectionSync({ mapRef, ready, selection, hoverState });

  // Pin overlays — MapLibre Markers wrapping React <Pin> components
  useMapPins({
    mapRef,
    ready,
    model,
    sectionCenters,
    selection,
    selectedListing,
    hoverState,
    displayMode,
    seatColors,
    isMobile,
    onSelect,
  });

  // Notify parent of zoom changes (drives displayMode via useSeatMapController)
  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  // Apply seatable section filter from manifest — excludes concourse/compound sections
  useEffect(() => {
    if (!ready || !mapRef.current || seatableIds.length === 0) return;
    const map = mapRef.current;
    const filter = ['in', ['get', 'id'], ['literal', seatableIds]] as const;
    map.setFilter(LAYER_SECTION_FILL, filter);
    map.setFilter(LAYER_SECTION_STROKE, filter);
    map.setFilter(LAYER_SECTION_LABEL, filter);
  }, [ready, seatableIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle layer visibility based on displayMode
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const sections: Visibility = displayMode === 'sections' ? 'visible' : 'none';
    const rows: Visibility = displayMode === 'rows' ? 'visible' : 'none';
    const seats: Visibility = displayMode === 'seats' ? 'visible' : 'none';
    setLayerVisibility(map, LAYER_SECTION_FILL, sections);
    setLayerVisibility(map, LAYER_SECTION_STROKE, sections);
    setLayerVisibility(map, LAYER_SECTION_LABEL, sections);
    setLayerVisibility(map, LAYER_ROW_FILL, rows);
    setLayerVisibility(map, LAYER_SEAT, seats);
  }, [ready, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fill-color expressions when theme or colors change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    // Rows and seats share the same sectionId-based match expression as sections
    // since their GeoJSON features all carry a sectionId property.
    const fillExpr = buildSectionFillExpression(theme, model, seatColors);
    map.setPaintProperty(LAYER_SECTION_FILL, 'fill-color', fillExpr);
    map.setPaintProperty(LAYER_ROW_FILL, 'fill-color', fillExpr);
    map.setPaintProperty(LAYER_SEAT, 'circle-color', fillExpr);
  }, [ready, theme, seatColors, model]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}
