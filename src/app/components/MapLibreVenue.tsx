import { useEffect, useMemo, useRef } from 'react';
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import { useMapLibre } from '../seatMap/maplibre/useMapLibre';
import { createVenueStyle } from '../seatMap/maplibre/createStyle';
import { useFeatureState } from '../seatMap/maplibre/useFeatureState';
import { useMapInteractions } from '../seatMap/maplibre/useMapInteractions';
import { useMapSelectionSync } from '../seatMap/maplibre/useMapSelectionSync';
import { useMapPins } from '../seatMap/maplibre/useMapPins';
import { buildSectionFillExpression } from '../seatMap/maplibre/paintExpressions';
import {
  LAYER_ROW,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SECTION,
  LAYER_SECTION_BASE,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_OUTLINE,
  LAYER_SECTION_SELECTED_OUTLINE,
  LAYER_SECTION_SELECTED_OVERLAY,
  SOURCE_SECTION_LABELS,
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
  venueFill: string;
  venueStroke: string;
  sectionStroke: string;
  mapBackground: string;
  sectionBase: string;
  rowStrokeColor: string;
  rowFillColor: string;
  mutedOverlay: string;
  selectedOverlay: string;
  onZoomChange?: (zoom: number) => void;
  onMapReady?: (map: MaplibreMap) => void;
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
  venueFill,
  venueStroke,
  sectionStroke,
  mapBackground,
  sectionBase,
  rowStrokeColor,
  rowFillColor,
  mutedOverlay,
  selectedOverlay,
  onZoomChange,
  onMapReady,
}: MapLibreVenueProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const style = useMemo(
    () => createVenueStyle({
      seatColors, assets, venueFill, venueStroke, sectionStroke,
      mapBackground, sectionBase, rowStrokeColor, rowFillColor, mutedOverlay, selectedOverlay,
    }),
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
  useFeatureState({ mapRef, ready, model, seatableIds });

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
    seatsUrl: assets.seatsUrl,
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

  // Expose map instance to parent once ready
  useEffect(() => {
    if (ready && mapRef.current) onMapReady?.(mapRef.current);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply seatable section filter from manifest — excludes concourse/compound sections.
  // Also restrict rows/seats to sections that have model data, so features with no
  // inventory don't render (or become interactive) when zoomed in.
  useEffect(() => {
    if (!ready || !mapRef.current || seatableIds.length === 0) return;
    const map = mapRef.current;

    const sectionFilter = ['in', ['get', 'id'], ['literal', seatableIds]] as const;
    map.setFilter(LAYER_SECTION, sectionFilter);
    map.setFilter(LAYER_SECTION_BASE, sectionFilter);
    map.setFilter(LAYER_SECTION_OUTLINE, sectionFilter);
    map.setFilter(LAYER_SECTION_SELECTED_OVERLAY, sectionFilter);

    const modelSectionIds = [...model.sectionDataById.keys()];
    const rowSeatFilter = ['in', ['get', 'sectionId'], ['literal', modelSectionIds]] as const;
    map.setFilter(LAYER_ROW, rowSeatFilter);
    map.setFilter(LAYER_ROW_OUTLINE, rowSeatFilter);
    map.setFilter(LAYER_ROW_SELECTED_OVERLAY, rowSeatFilter);
    map.setFilter(LAYER_ROW_LABEL, rowSeatFilter);
    map.setFilter(LAYER_SEAT, rowSeatFilter);
  }, [ready, seatableIds, model]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate section label points — one Point per section at its manifest center.
  // Switching to a point source (vs. polygon source) guarantees exactly one label per section.
  useEffect(() => {
    if (!ready || !mapRef.current || sectionCenters.size === 0) return;
    const map = mapRef.current;
    const features = Array.from(sectionCenters.entries())
      .filter(([sectionId]) => { const n = Number(sectionId); return n >= 101 && n <= 334; })
      .map(([sectionId, entry]) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: entry.center },
        properties: { sectionId },
      }));
    (map.getSource(SOURCE_SECTION_LABELS) as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });
  }, [ready, sectionCenters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle layer visibility based on displayMode.
  // Production uses opacity crossfade; prototype uses hard visibility toggles.
  // See displayMode × layer visibility matrix in the plan.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const isSections = displayMode === 'sections';
    const isRows = displayMode === 'rows';
    const isSeats = displayMode === 'seats';

    // Section fills: only in sections mode
    map.setPaintProperty(LAYER_SECTION, 'fill-opacity', isSections ? 1 : 0);

    // Section-selected-overlay: only in sections mode (visibility also depends on selection)
    if (!isSections) setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'none');

    // Rows: visible in rows + seats
    setLayerVisibility(map, LAYER_ROW, (isRows || isSeats) ? 'visible' : 'none');
    setLayerVisibility(map, LAYER_ROW_OUTLINE, (isRows || isSeats) ? 'visible' : 'none');

    // Row-selected-overlay: rows mode only (also depends on selection)
    if (!isRows) setLayerVisibility(map, LAYER_ROW_SELECTED_OVERLAY, 'none');

    // Seats: only in seats mode
    setLayerVisibility(map, LAYER_SEAT, isSeats ? 'visible' : 'none');

    // Section-outline: always visible, opacity varies.
    // Production: 0.3 at section zoom → 1.0 at row zoom.
    map.setPaintProperty(LAYER_SECTION_OUTLINE, 'line-opacity', isSections ? 0.3 : 1.0);

    // Section-selected-outline: rows/seats only (also depends on selection)
    if (isSections) setLayerVisibility(map, LAYER_SECTION_SELECTED_OUTLINE, 'none');

    // Section-label: always visible, opacity varies.
    // Production: 1.0 at section zoom → 0.3 at row zoom.
    map.setPaintProperty(LAYER_SECTION_LABEL, 'text-opacity', isSections ? 1.0 : 0.3);
  }, [ready, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Section selection overlay — dark tint on selected, white mute on all others.
  // Production: section-selected-overlay uses match expression on feature id, updated via setPaintProperty.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const hasSelection = !!selection.sectionId;

    if (hasSelection && displayMode === 'sections') {
      // Show overlay with match expression: selected → dark, others → muted
      map.setPaintProperty(LAYER_SECTION_SELECTED_OVERLAY, 'fill-color',
        ['match', ['get', 'id'], selection.sectionId,
          selectedOverlay, mutedOverlay]);
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'visible');
    } else {
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'none');
    }

    // Section-selected-outline: visible in rows/seats when section selected.
    // Production: line-width transitions 0→2px; prototype uses visibility toggle.
    if (hasSelection && displayMode !== 'sections') {
      map.setFilter(LAYER_SECTION_SELECTED_OUTLINE, ['==', ['get', 'id'], selection.sectionId]);
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OUTLINE, 'visible');
    } else {
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OUTLINE, 'none');
    }
  }, [ready, displayMode, selection.sectionId, mutedOverlay, selectedOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Row selection overlay — selected row gets dark tint, siblings get white mute.
  // Production: row-selected-overlay with match expression; prototype uses feature-state.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const showMuted = displayMode === 'rows' && !!selection.rowId;
    setLayerVisibility(mapRef.current, LAYER_ROW_SELECTED_OVERLAY, showMuted ? 'visible' : 'none');
  }, [ready, displayMode, selection.rowId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fill-color expressions when theme or colors change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    // Rows and seats share the same sectionId-based match expression as sections
    // since their GeoJSON features all carry a sectionId property.
    const fillExpr = buildSectionFillExpression(theme, model, seatColors);
    map.setPaintProperty(LAYER_SECTION, 'fill-color', fillExpr);
    map.setPaintProperty(LAYER_ROW, 'fill-color', rowFillColor);
    map.setPaintProperty(LAYER_SEAT, 'circle-color', fillExpr);
  }, [ready, theme, seatColors, model, rowFillColor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up remaining style properties so controls panel changes are reflected on the map.
  // Fill-color expressions (above) cover available/hover/unavailable; this effect covers
  // background, outlines, labels, and other static paint properties.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    // Background
    map.setPaintProperty('background', 'background-color', mapBackground);

    // Venue chrome
    map.setPaintProperty('venue', 'fill-color', venueFill);
    map.setPaintProperty('venue-stroke', 'line-color', venueStroke);

    // Section base
    map.setPaintProperty(LAYER_SECTION_BASE, 'fill-color', sectionBase);

    // Section outline
    map.setPaintProperty(LAYER_SECTION_OUTLINE, 'line-color', sectionStroke);
    map.setPaintProperty(LAYER_SECTION_SELECTED_OUTLINE, 'line-color', sectionStroke);

    // Row outline
    map.setPaintProperty(LAYER_ROW_OUTLINE, 'line-color', rowStrokeColor);

    // Section labels
    map.setPaintProperty(LAYER_SECTION_LABEL, 'text-color', seatColors.labelDefault);

    // Row selected overlay colors (feature-state expression must be rebuilt to change color values)
    map.setPaintProperty(LAYER_ROW_SELECTED_OVERLAY, 'fill-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], selectedOverlay,
      mutedOverlay,
    ]);
  }, [ready, seatColors, venueFill, venueStroke, sectionStroke, mapBackground, sectionBase, rowStrokeColor, mutedOverlay, selectedOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}
