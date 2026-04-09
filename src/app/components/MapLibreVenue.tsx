import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MaplibreMap } from 'maplibre-gl';
import { useMapLibre } from '../seatMap/maplibre/useMapLibre';
import { createVenueStyle } from '../seatMap/maplibre/createStyle';
import { useFeatureState } from '../seatMap/maplibre/useFeatureState';
import { useMapInteractions } from '../seatMap/maplibre/useMapInteractions';
import { useMapSelectionSync } from '../seatMap/maplibre/useMapSelectionSync';
import { useMapPins } from '../seatMap/maplibre/useMapPins';
import { useListingConnectors } from '../seatMap/maplibre/useListingConnectors';
import { useSeatCoordinates } from '../seatMap/maplibre/useSeatCoordinates';
import { deriveVisualSeatAssignments } from '../seatMap/maplibre/deriveVisualSeatAssignments';
import {
  buildSectionFillExpression,
  buildConnectorColorExpression,
  buildDetailFillExpression,
} from '../seatMap/maplibre/paintExpressions';
import {
  loadDecoratedRowsGeoJson,
  loadDecoratedSeatsGeoJson,
} from '../seatMap/maplibre/loadDecoratedDetailGeoJson';
import {
  LAYER_ROW,
  LAYER_ROW_HOVER_OVERLAY,
  LAYER_ROW_LABEL,
  LAYER_ROW_OUTLINE,
  LAYER_ROW_SELECTED_OUTLINE,
  LAYER_ROW_SELECTED_OVERLAY,
  LAYER_SEAT,
  LAYER_SEAT_CONNECTOR,
  LAYER_SEAT_CONNECTOR_HOVER_OVERLAY,
  LAYER_SEAT_CONNECTOR_MUTED_OVERLAY,
  LAYER_SEAT_CONNECTOR_SELECTED_OVERLAY,
  LAYER_SEAT_HOVER_OVERLAY,
  LAYER_SEAT_MUTED_OVERLAY,
  LAYER_SEAT_SELECTED_OVERLAY,
  SEAT_FILTERED_LAYERS,
  SEAT_VISIBILITY_LAYERS,
  SEAT_MUTED_LAYERS,
  LAYER_SECTION,
  LAYER_SECTION_BASE,
  LAYER_SECTION_HOVER_OVERLAY,
  LAYER_SECTION_LABEL,
  LAYER_SECTION_OUTLINE,
  LAYER_SECTION_SELECTED_OUTLINE,
  LAYER_SECTION_SELECTED_OVERLAY,
  SOURCE_ROWS,
  SOURCE_SEATS,
  SOURCE_SEAT_CONNECTORS,
  SOURCE_SECTION_LABELS,
  VENUE_BOUNDS,
} from '../seatMap/maplibre/constants';
import type { SeatColors, DisplayMode, SelectionState, HoverState, Listing, PinData } from '../seatMap/model/types';
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
  zoomedDisplay: DisplayMode;
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
  filteredListingsBySection?: Map<string, Listing[]>;
  filteredPinsBySection?: Map<string, PinData[]>;
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
  zoomedDisplay,
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
  filteredListingsBySection,
  filteredPinsBySection,
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
      seatColors, theme, assets, venueFill, venueStroke, sectionStroke,
      mapBackground, sectionBase, rowStrokeColor, rowFillColor, overlays: effectiveOverlays,
    }),
    // Recreates when venue assets change (venue switch); paint properties updated imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets],
  );

  const { mapRef, ready } = useMapLibre({
    containerRef,
    style,
    bounds: VENUE_BOUNDS,
    fitBoundsPadding: isMobile ? 20 : 40,
    minZoom: isMobile ? 10 : 12,
    maxZoom: isMobile ? 17 : 18,
    onZoomChange,
  });

  // Deferred loading: rows + seats sources start empty in createVenueStyle.
  // Load real data when displayMode first leaves 'sections' (user zoomed in).
  const [detailSourcesLoaded, setDetailSourcesLoaded] = useState(false);
  const detailLoadRequestRef = useRef(0);
  const loadedDetailAssetKeyRef = useRef<string | null>(null);
  const detailAssetKey = `${assets.rowsUrl}|${assets.seatsUrl}`;
  useEffect(() => {
    setDetailSourcesLoaded(false);
  }, [assets.rowsUrl, assets.seatsUrl]);

  // Build an effective model that uses filtered listings/pins when provided
  const effectiveModel = useMemo(() => {
    if (!filteredListingsBySection && !filteredPinsBySection) return model;
    return {
      ...model,
      listings: filteredListingsBySection
        ? Array.from(filteredListingsBySection.values()).flat()
        : model.listings,
      listingsBySection: filteredListingsBySection ?? model.listingsBySection,
      pinsBySection: filteredPinsBySection ?? model.pinsBySection,
    };
  }, [model, filteredListingsBySection, filteredPinsBySection]);

  const visualSeatAssignments = useMemo(
    () => deriveVisualSeatAssignments(effectiveModel),
    [effectiveModel],
  );

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const detailLoadedForCurrentAssets =
      detailSourcesLoaded && loadedDetailAssetKeyRef.current === detailAssetKey;
    if (displayMode === 'sections' && !detailLoadedForCurrentAssets) return;

    const map = mapRef.current;
    const requestId = ++detailLoadRequestRef.current;
    let cancelled = false;

    async function loadDetails() {
      const [rowsData, seatsData] = await Promise.all([
        loadDecoratedRowsGeoJson(assets.rowsUrl, effectiveModel),
        loadDecoratedSeatsGeoJson(assets.seatsUrl, effectiveModel),
      ]);

      if (cancelled || requestId !== detailLoadRequestRef.current || !mapRef.current) return;

      (map.getSource(SOURCE_ROWS) as GeoJSONSource).setData(rowsData);
      (map.getSource(SOURCE_SEATS) as GeoJSONSource).setData(seatsData);
      loadedDetailAssetKeyRef.current = detailAssetKey;
      setDetailSourcesLoaded(true);
    }

    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    displayMode,
    assets.rowsUrl,
    assets.seatsUrl,
    detailAssetKey,
    effectiveModel.listings,
    detailSourcesLoaded,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire inventory feature states (available/unavailable)
  useFeatureState({ mapRef, ready, model: effectiveModel, seatableIds });

  const listingsBySeatId = useMemo(() => {
    const m = new Map<string, (typeof effectiveModel.listings)[0]>();
    for (const [seatId, listing] of visualSeatAssignments.visualSeatListingBySeatId) {
      m.set(seatId, listing);
    }
    return m;
  }, [visualSeatAssignments]);

  // Sync React selection/hover state → MapLibre feature state + paint expressions
  const { syncHoverFromMap } = useMapSelectionSync({ mapRef, ready, selection, hoverState, displayMode, overlays: { row: effectiveOverlays.row } });

  // Wire click/hover event handlers on map layers
  useMapInteractions({
    mapRef,
    ready,
    onSelect,
    onHover,
    syncHoverFromMap,
    isMobile,
    listingsBySeatId,
    visualSeatIdsByListingId: visualSeatAssignments.visualSeatIdsByListingId,
    visualRowIdByListingId: visualSeatAssignments.visualRowIdByListingId,
  });

  // Pin overlays — MapLibre Markers wrapping React <Pin> components
  useMapPins({
    mapRef,
    ready,
    model: effectiveModel,
    sectionCenters,
    seatsUrl: assets.seatsUrl,
    selection,
    selectedListing,
    hoverState,
    displayMode,
    zoomedDisplay,
    seatColors,
    isMobile,
    pinDensity,
    onSelect,
    visualSeatIdsByListingId: visualSeatAssignments.visualSeatIdsByListingId,
    visualRowIdByListingId: visualSeatAssignments.visualRowIdByListingId,
    visualRowNumberByListingId: visualSeatAssignments.visualRowNumberByListingId,
  });

  // Cached seat coordinates — fetched once, reused for all connector rebuilds
  const seatCoords = useSeatCoordinates({ seatsUrl: assets.seatsUrl, detailSourcesLoaded });

  // Listing connector lines — LineStrings connecting seats in the same listing
  useListingConnectors({ mapRef, ready, listings: effectiveModel.listings, coordsBySeatId: seatCoords });

  // Zoom changes are now reported directly from useMapLibre's map event listener,
  // bypassing React state entirely to avoid re-rendering MapLibreVenue on every frame.

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

    // Keep detail geometry visible for every seatable section we have model data for so
    // no-inventory rows/seats render unavailable instead of disappearing.
    const modeledSectionIds = [...effectiveModel.sectionDataById.keys()];
    const rowSeatFilter = ['in', ['get', 'sectionId'], ['literal', modeledSectionIds]] as const;
    map.setFilter(LAYER_ROW, rowSeatFilter);
    map.setFilter(LAYER_ROW_HOVER_OVERLAY, rowSeatFilter);
    map.setFilter(LAYER_ROW_OUTLINE, rowSeatFilter);
    map.setFilter(LAYER_ROW_SELECTED_OVERLAY, rowSeatFilter);
    map.setFilter(LAYER_ROW_SELECTED_OUTLINE, rowSeatFilter);
    map.setFilter(LAYER_ROW_LABEL, rowSeatFilter);
    for (const layer of SEAT_FILTERED_LAYERS) map.setFilter(layer, rowSeatFilter);
    // LAYER_SEAT_SELECTED_OVERLAY filter is managed by the seat selection effect below
  }, [ready, seatableIds, effectiveModel]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setLayerVisibility(map, LAYER_ROW_LABEL, 'none');

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

  // Memoize expensive 163-case match expressions — only rebuild when theme/model/colors change,
  // not on every displayMode transition (zoom threshold crossing).
  const sectionFillExpr = useMemo(
    () => buildSectionFillExpression(theme, model, seatColors),
    [theme, model, seatColors],
  );
  const detailFillExpr = useMemo(
    () => buildDetailFillExpression(theme, model, seatColors),
    [theme, model, seatColors],
  );
  const connectorColorExpr = useMemo(
    () => buildConnectorColorExpression(theme, model, seatColors),
    [theme, model, seatColors],
  );

  // Update fill-color expressions when theme, colors, or displayMode change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    map.setPaintProperty(LAYER_SECTION, 'fill-color', sectionFillExpr);
    // Rows mode: inherit section zone color so each row matches its section's hue.
    // Seats mode: white background so seat circles stand out against a neutral field.
    map.setPaintProperty(LAYER_ROW, 'fill-color', displayMode === 'seats' ? rowFillColor : detailFillExpr);
    map.setPaintProperty(LAYER_SEAT, 'circle-color', detailFillExpr);
    map.setPaintProperty(LAYER_SEAT_CONNECTOR, 'line-color', connectorColorExpr);
  }, [ready, sectionFillExpr, detailFillExpr, connectorColorExpr, rowFillColor, displayMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Split paint property updates into focused effects ---
  // Each effect only fires when its specific dependencies change, avoiding 25+
  // setPaintProperty calls on every displayMode transition (zoom threshold crossing).

  // Effect A: Background + venue chrome (only changes from controls panel)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    map.setPaintProperty('background', 'background-color', mapBackground);
    map.setPaintProperty('venue', 'fill-color', venueFill);
    map.setPaintProperty('venue-stroke', 'line-color', venueStroke);
  }, [ready, mapBackground, venueFill, venueStroke]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect B: Section paint (base, outlines, labels, hover overlay)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    map.setPaintProperty(LAYER_SECTION_BASE, 'fill-color', sectionBase);
    map.setPaintProperty(LAYER_SECTION_OUTLINE, 'line-color', sectionStroke);
    map.setPaintProperty(LAYER_SECTION_SELECTED_OUTLINE, 'line-color', effectiveOverlays.section.selectedOutline);
    map.setPaintProperty(LAYER_SECTION_LABEL, 'text-color', seatColors.labelDefault);
    const sectionHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], effectiveOverlays.section.hover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_SECTION_HOVER_OVERLAY, 'fill-color', sectionHoverExpr);
  }, [ready, sectionBase, sectionStroke, seatColors.labelDefault, effectiveOverlays.section]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect C: Row + seat paint (outlines, overlays, hover expressions)
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const connectorHoverColor = (theme === 'zone' || theme === 'deal')
      ? effectiveOverlays.seat.hover
      : seatColors.hover;

    // Row outline — transparent on selected row to avoid darkened stroke against overlay
    map.setPaintProperty(LAYER_ROW_OUTLINE, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], 'rgba(0,0,0,0)',
      rowStrokeColor,
    ]);

    // Row selected overlay fill-color is managed by useMapSelectionSync (expression-driven muting)

    // Row selected outline
    map.setPaintProperty(LAYER_ROW_SELECTED_OUTLINE, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], effectiveOverlays.row.selectedOutline,
      'rgba(0,0,0,0)',
    ]);

    // Row hover overlay
    const rowHover = (displayMode === 'seats' && effectiveOverlays.row.hoverInSeats)
      ? effectiveOverlays.row.hoverInSeats
      : effectiveOverlays.row.hover;
    const rowHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], rowHover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_ROW_HOVER_OVERLAY, 'fill-color', rowHoverExpr);

    // Seat muted overlay color — transparent on hovered seats for hover-reveal
    map.setPaintProperty(LAYER_SEAT_MUTED_OVERLAY, 'circle-color', [
      'case',
      ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
      effectiveOverlays.seat.muted,
    ]);

    // Connector hover overlay
    map.setPaintProperty(LAYER_SEAT_CONNECTOR_HOVER_OVERLAY, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'hovered'], false], connectorHoverColor,
      'rgba(0,0,0,0)',
    ]);

    // Connector muted overlay stays transparent for hovered/selected listings so
    // state overlays punch through the white wash.
    map.setPaintProperty(LAYER_SEAT_CONNECTOR_MUTED_OVERLAY, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'hovered'], false], 'rgba(4,9,44,0)',
      ['boolean', ['feature-state', 'selected'], false], 'rgba(4,9,44,0)',
      effectiveOverlays.seat.muted,
    ]);

    // Connector selected state reuses the seat pressed token.
    map.setPaintProperty(LAYER_SEAT_CONNECTOR_SELECTED_OVERLAY, 'line-color', [
      'case',
      ['boolean', ['feature-state', 'selected'], false], seatColors.pressed,
      'rgba(0,0,0,0)',
    ]);

    // Seat selected overlay
    map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-color', effectiveOverlays.seat.selected);
    map.setPaintProperty(LAYER_SEAT_SELECTED_OVERLAY, 'circle-stroke-color', effectiveOverlays.seat.selectedOutline);

    // Seat hover overlay
    const seatHoverExpr = ['case', ['boolean', ['feature-state', 'hovered'], false], effectiveOverlays.seat.hover, 'rgba(0,0,0,0)'] as const;
    map.setPaintProperty(LAYER_SEAT_HOVER_OVERLAY, 'circle-color', seatHoverExpr);
  }, [ready, rowStrokeColor, effectiveOverlays.row, effectiveOverlays.seat, displayMode, seatColors.hover, seatColors.pressed, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}
