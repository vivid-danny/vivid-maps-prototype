import { useEffect, useMemo, useRef } from 'react';
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import { useMapLibre } from '../seatMap/maplibre/useMapLibre';
import { createVenueStyle } from '../seatMap/maplibre/createStyle';
import { useFeatureState } from '../seatMap/maplibre/useFeatureState';
import { useMapInteractions } from '../seatMap/maplibre/useMapInteractions';
import { useMapSelectionSync } from '../seatMap/maplibre/useMapSelectionSync';
import { useMapPins } from '../seatMap/maplibre/useMapPins';
import { useListingConnectors } from '../seatMap/maplibre/useListingConnectors';
import { buildSectionFillExpression, buildConnectorColorExpression } from '../seatMap/maplibre/paintExpressions';
import {
  LAYER_ROW,
  LAYER_ROW_HOVER_OVERLAY,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SEAT_CONNECTOR,
  LAYER_SEAT_HOVER_OVERLAY,
  LAYER_SEAT_MUTED_OVERLAY,
  LAYER_SEAT_SELECTED_OVERLAY,
  SEAT_VISIBILITY_LAYERS,
  SEAT_FILTERED_LAYERS,
  SEAT_MUTED_LAYERS,
  LAYER_SECTION,
  LAYER_SECTION_BASE,
  LAYER_SECTION_HOVER_OVERLAY,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_OUTLINE,
  LAYER_SECTION_SELECTED_OUTLINE,
  LAYER_SECTION_SELECTED_OVERLAY,
  SOURCE_SEAT_CONNECTORS,
  SOURCE_SECTION_LABELS,
  VENUE_BOUNDS,
} from '../seatMap/maplibre/constants';
import type { SeatColors, DisplayMode, SelectionState, HoverState, Listing } from '../seatMap/model/types';
import type { SeatMapModel } from '../seatMap/model/types';
import type { ThemeId } from '../seatMap/config/themes';
import type { SeatMapConfig, LevelOverlays } from '../seatMap/config/types';
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
  pinDensity: SeatMapConfig['pinDensity'];
  venueFill: string;
  venueStroke: string;
  sectionStroke: string;
  mapBackground: string;
  sectionBase: string;
  rowStrokeColor: string;
  rowFillColor: string;
  overlays: { section: LevelOverlays; row: LevelOverlays; seat: LevelOverlays };
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
  pinDensity,
  venueFill,
  venueStroke,
  sectionStroke,
  mapBackground,
  sectionBase,
  rowStrokeColor,
  rowFillColor,
  overlays,
  onZoomChange,
  onMapReady,
}: MapLibreVenueProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // For zone/deal: overlay compositing handles hover; fill expression stays unchanged.
  // For branded: fill expression handles hover via seatColors.hover; overlay is transparent.
  const effectiveOverlays = useMemo(() => {
    if (theme === 'zone' || theme === 'deal') return overlays;
    return {
      section: { ...overlays.section, hover: 'rgba(0,0,0,0)' },
      row: { ...overlays.row, hover: 'rgba(0,0,0,0)' },
      seat: { ...overlays.seat, hover: 'rgba(0,0,0,0)' },
    };
  }, [overlays, theme]);

  const style = useMemo(
    () => createVenueStyle({
      seatColors, assets, venueFill, venueStroke, sectionStroke,
      mapBackground, sectionBase, rowStrokeColor, rowFillColor, overlays: effectiveOverlays,
    }),
    // Recreates when venue assets change (venue switch); paint properties updated imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets],
  );

  const { mapRef, zoom, ready } = useMapLibre({
    containerRef,
    style,
    bounds: VENUE_BOUNDS,
    fitBoundsPadding: isMobile ? 20 : 40,
  });

  // Wire inventory feature states (available/unavailable)
  useFeatureState({ mapRef, ready, model, seatableIds });

  const listingsBySeatId = useMemo(() => {
    const m = new Map<string, (typeof model.listings)[0]>();
    for (const listing of model.listings) {
      for (const seatId of listing.seatIds) {
        m.set(seatId, listing);
      }
    }
    return m;
  }, [model.listings]);

  // Sync React selection/hover state → MapLibre feature state
  const { syncHoverFromMap } = useMapSelectionSync({ mapRef, ready, selection, hoverState, sectionDataById: model.sectionDataById, displayMode });

  // Wire click/hover event handlers on map layers
  useMapInteractions({ mapRef, ready, onSelect, onHover, syncHoverFromMap, isMobile, listingsBySeatId });

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
    pinDensity,
    onSelect,
  });

  // Listing connector lines — LineStrings connecting seats in the same listing
  useListingConnectors({ mapRef, ready, listings: model.listings });

  // Notify parent of zoom changes (drives displayMode via useSeatMapController)
  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  // Expose map instance to parent once ready
  useEffect(() => {
    if (ready && mapRef.current) onMapReady?.(mapRef.current);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile: use smaller section label text-size so 69 labels don't crowd the zoomed-out view.
  // Desktop uses the static values from createStyle.ts unchanged.
  useEffect(() => {
    if (!ready || !mapRef.current || !isMobile) return;
    mapRef.current.setLayoutProperty(LAYER_SECTION_LABEL, 'text-size',
      ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 16]);
  }, [ready, isMobile]);

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
    map.setFilter(LAYER_SECTION_HOVER_OVERLAY, sectionFilter);
    map.setFilter(LAYER_SECTION_SELECTED_OVERLAY, sectionFilter);

    // Only show rows/seats for sections that have listings (inventory)
    const sectionsWithListings = [...model.listingsBySection.keys()];
    const rowSeatFilter = ['in', ['get', 'sectionId'], ['literal', sectionsWithListings]] as const;
    map.setFilter(LAYER_ROW, rowSeatFilter);
    map.setFilter(LAYER_ROW_HOVER_OVERLAY, rowSeatFilter);
    map.setFilter(LAYER_ROW_OUTLINE, rowSeatFilter);
    map.setFilter(LAYER_ROW_SELECTED_OVERLAY, rowSeatFilter);
    map.setFilter(LAYER_ROW_SELECTED_OUTLINE, rowSeatFilter);
    map.setFilter(LAYER_ROW_LABEL, rowSeatFilter);
    for (const layer of SEAT_FILTERED_LAYERS) map.setFilter(layer, rowSeatFilter);
    // LAYER_SEAT_SELECTED_OVERLAY filter is managed by the seat selection effect below
  }, [ready, seatableIds, model]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate section label points — one Point per section at its manifest center.
  // Switching to a point source (vs. polygon source) guarantees exactly one label per section.
  useEffect(() => {
    if (!ready || !mapRef.current || sectionCenters.size === 0) return;
    const map = mapRef.current;
    const hiddenLabels = ['1000', '998', '996'];
    const features = Array.from(sectionCenters.entries())
      .filter(([sectionId]) => seatableIds.includes(sectionId) && !hiddenLabels.includes(sectionId))
      .map(([sectionId, entry]) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: entry.center },
        properties: { sectionId },
      }));
    (map.getSource(SOURCE_SECTION_LABELS) as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features,
    });
  }, [ready, sectionCenters, seatableIds]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Section hover + selected overlays: only in sections mode
    setLayerVisibility(map, LAYER_SECTION_HOVER_OVERLAY, isSections ? 'visible' : 'none');
    if (!isSections) setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'none');

    // Rows: visible in rows + seats
    setLayerVisibility(map, LAYER_ROW, (isRows || isSeats) ? 'visible' : 'none');
    setLayerVisibility(map, LAYER_ROW_HOVER_OVERLAY, (isRows || isSeats) ? 'visible' : 'none');
    setLayerVisibility(map, LAYER_ROW_OUTLINE, (isRows || isSeats) ? 'visible' : 'none');

    // Row-selected-overlay: rows + seats (handles both row selection and cross-level parentMuted)
    setLayerVisibility(map, LAYER_ROW_SELECTED_OVERLAY, (isRows || isSeats) ? 'visible' : 'none');

    // Row-selected-outline: rows + seats (paint expression handles transparency when nothing selected)
    setLayerVisibility(map, LAYER_ROW_SELECTED_OUTLINE, (isRows || isSeats) ? 'visible' : 'none');

    // Seats + connectors: only in seats mode
    for (const layer of SEAT_VISIBILITY_LAYERS) setLayerVisibility(map, layer, isSeats ? 'visible' : 'none');
    // LAYER_SEAT_SELECTED_OVERLAY visibility managed by seat selection effect
    // LAYER_SEAT_CONNECTOR_MUTED_OVERLAY visibility managed by seat muted overlay effect

    // Section-outline: always visible, opacity varies.
    // Production: 0.3 at section zoom → 1.0 at row zoom.
    map.setPaintProperty(LAYER_SECTION_OUTLINE, 'line-opacity', isSections ? 0.3 : 1.0);

    // Section-selected-outline: visibility owned by selection effect (all zoom levels)

    // Section-label: always visible, opacity varies.
    // Production: 1.0 at section zoom → 0.3 at row zoom.
    map.setPaintProperty(LAYER_SECTION_LABEL, 'text-opacity', isSections ? 1.0 : 0.3);
  }, [ready, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Section selection overlay — dark tint on selected, white mute on all others.
  // Only active in sections mode. Cross-level muting in rows/seats mode is handled
  // by parentMuted feature-state on the row-selected-overlay layer.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const hasSelection = !!selection.sectionId;

    if (hasSelection && displayMode === 'sections') {
      // Show overlay: selected → dark tint, hovered → transparent (unmute), others → muted
      map.setPaintProperty(LAYER_SECTION_SELECTED_OVERLAY, 'fill-color', [
        'case',
        ['==', ['get', 'id'], selection.sectionId], effectiveOverlays.section.selected,
        ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
        effectiveOverlays.section.muted,
      ]);
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'visible');
    } else {
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OVERLAY, 'none');
    }

    // Section-selected-outline: visible whenever section is selected (all zoom levels).
    // Production: line-width transitions 0→2px; prototype uses visibility toggle.
    if (hasSelection) {
      map.setFilter(LAYER_SECTION_SELECTED_OUTLINE, ['==', ['get', 'id'], selection.sectionId]);
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OUTLINE, 'visible');
    } else {
      setLayerVisibility(map, LAYER_SECTION_SELECTED_OUTLINE, 'none');
    }
  }, [ready, displayMode, selection.sectionId, effectiveOverlays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seat selection overlay — dark tint + outline ring on directly selected seats only.
  // Only shown when specific seatIds are selected (not for row-level selections).
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const { seatIds } = selection;

    if (displayMode === 'seats' && seatIds.length > 0) {
      map.setFilter(LAYER_SEAT_SELECTED_OVERLAY, [
        'in', ['get', 'id'], ['literal', seatIds],
      ]);
      setLayerVisibility(map, LAYER_SEAT_SELECTED_OVERLAY, 'visible');
    } else {
      setLayerVisibility(map, LAYER_SEAT_SELECTED_OVERLAY, 'none');
    }
  }, [ready, displayMode, selection.seatIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seat muted overlay — white wash on all seats outside the selected section.
  // Hover-reveal filter updates are handled synchronously by syncHover in useMapSelectionSync.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    if (displayMode === 'seats' && selection.sectionId) {
      const mutedFilter: any = ['!=', ['get', 'sectionId'], selection.sectionId];
      for (const layer of SEAT_MUTED_LAYERS) map.setFilter(layer, mutedFilter);
      for (const layer of SEAT_MUTED_LAYERS) setLayerVisibility(map, layer, 'visible');
    } else {
      for (const layer of SEAT_MUTED_LAYERS) setLayerVisibility(map, layer, 'none');
    }
  }, [ready, displayMode, selection.sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update fill-color expressions when theme, colors, or displayMode change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    // buildSectionFillExpression uses ['get', 'sectionId'] for zone/deal themes, so it works
    // on both section and row features (rows carry a sectionId property).
    const fillExpr = buildSectionFillExpression(theme, model, seatColors);
    map.setPaintProperty(LAYER_SECTION, 'fill-color', fillExpr);
    // Rows mode: inherit section zone color so each row matches its section's hue.
    // Seats mode: white background so seat circles stand out against a neutral field.
    map.setPaintProperty(LAYER_ROW, 'fill-color', displayMode === 'seats' ? rowFillColor : fillExpr);
    map.setPaintProperty(LAYER_SEAT, 'circle-color', fillExpr);
    map.setPaintProperty(LAYER_SEAT_CONNECTOR, 'line-color', buildConnectorColorExpression(theme, model, seatColors));
  }, [ready, theme, seatColors, model, rowFillColor, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    map.setPaintProperty(LAYER_SECTION_SELECTED_OUTLINE, 'line-color', effectiveOverlays.section.selectedOutline);

    // Row outline — transparent on selected row to avoid darkened stroke against overlay
    map.setPaintProperty(LAYER_ROW_OUTLINE, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], 'rgba(0,0,0,0)',
      rowStrokeColor,
    ]);

    // Section labels
    map.setPaintProperty(LAYER_SECTION_LABEL, 'text-color', seatColors.labelDefault);

    // Row selected overlay (feature-state expression must be rebuilt to change color values)
    // In seats mode, use softer override values so row tints don't obscure seat circles.
    const rowSelected = (displayMode === 'seats' && effectiveOverlays.row.selectedInSeats)
      ? effectiveOverlays.row.selectedInSeats
      : effectiveOverlays.row.selected;
    map.setPaintProperty(LAYER_ROW_SELECTED_OVERLAY, 'fill-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], rowSelected,
      ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
      ['boolean', ['feature-state', 'parentMuted'], false], effectiveOverlays.row.muted,
      'rgba(4,9,44,0)',
    ]);

    // Row selected outline
    map.setPaintProperty(LAYER_ROW_SELECTED_OUTLINE, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], effectiveOverlays.row.selectedOutline,
      'rgba(0,0,0,0)',
    ]);

    // Seat muted overlay color — transparent on hovered seats for hover-reveal
    map.setPaintProperty(LAYER_SEAT_MUTED_OVERLAY, 'circle-color', [
      'case',
      ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
      effectiveOverlays.seat.muted,
    ]);

    // Seat selected overlay (filter controls which seats are visible; simple values here)
    map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-color', effectiveOverlays.seat.selected);
    map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-stroke-color', effectiveOverlays.seat.selectedOutline);

    // Hover overlays (feature-state expression must be rebuilt to pick up color changes)
    const sectionHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], effectiveOverlays.section.hover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_SECTION_HOVER_OVERLAY, 'fill-color', sectionHoverExpr);
    const rowHover = (displayMode === 'seats' && effectiveOverlays.row.hoverInSeats)
      ? effectiveOverlays.row.hoverInSeats
      : effectiveOverlays.row.hover;
    const rowHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], rowHover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_ROW_HOVER_OVERLAY, 'fill-color', rowHoverExpr);
    const seatHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], effectiveOverlays.seat.hover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_SEAT_HOVER_OVERLAY, 'circle-color', seatHoverExpr);
  }, [ready, seatColors, venueFill, venueStroke, sectionStroke, mapBackground, sectionBase, rowStrokeColor, effectiveOverlays, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}
