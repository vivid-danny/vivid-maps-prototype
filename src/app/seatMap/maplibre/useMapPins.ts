import { useEffect, useRef, useMemo, useState, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Pin } from '../../components/Pin';
import { buildSectionSelection, buildRowSelection, buildListingSelection } from '../behavior/rules';
import {
  declutterPins,
  getBestDealListingWithMinScoreFallback,
  MAPLIBRE_DECLUTTER_BASE_DISTANCE,
  splitSeatModePins,
} from '../behavior/pins';
import type { ResolvedPin } from '../behavior/pins';
import type { PinDensityConfig } from '../config/types';
import type { PinData, SeatColors, DisplayMode, SelectionState, HoverState, Listing, SeatMapModel } from '../model/types';
import type { SectionManifestEntry } from './useVenueManifest';

interface UseMapPinsOptions {
  mapRef: React.RefObject<MapLibreMap | null>;
  ready: boolean;
  model: SeatMapModel;
  sectionCenters: Map<string, SectionManifestEntry>;
  seatsUrl: string;
  selection: SelectionState;
  selectedListing: Listing | null;
  hoverState: HoverState;
  displayMode: DisplayMode;
  zoomedDisplay: DisplayMode;
  seatColors: SeatColors;
  isMobile: boolean;
  pinDensity: PinDensityConfig;
  onSelect: (selection: SelectionState) => void;
  visualSeatIdsByListingId: Map<string, string[]>;
  visualRowIdByListingId: Map<string, string | null>;
  visualRowNumberByListingId: Map<string, number | null>;
}

interface PinRenderData {
  listingId: string;
  lngLat: [number, number];
  sectionId: string;
  listing: Listing;
  isHovered: boolean;
  isSelected: boolean;
}

interface MarkerEntry {
  marker: Marker;
  root: Root;
  isHovered: boolean;
  isSelected: boolean;
  interactive: boolean;
}

// Sentinel ID for the on-the-fly hover pin (a row with no pre-existing pin candidate).
const HOVER_PIN_ID = '__hover__';

interface ResolvePinLngLatParams {
  displayMode: DisplayMode;
  listing: Listing;
  sectionData: SectionManifestEntry;
  seatCoords: Map<string, [number, number]>;
  visualSeatIdsByListingId: Map<string, string[]>;
  visualRowIdByListingId: Map<string, string | null>;
}

function getVisualSeatIds(listing: Listing, visualSeatIdsByListingId: Map<string, string[]>): string[] {
  return visualSeatIdsByListingId.get(listing.listingId) ?? listing.seatIds;
}

function getVisualRowId(listing: Listing, visualRowIdByListingId: Map<string, string | null>): string | null {
  return visualRowIdByListingId.get(listing.listingId) ?? listing.rowId;
}

function getVisualRowNumber(listing: Listing, visualRowNumberByListingId: Map<string, number | null>): number | null {
  return visualRowNumberByListingId.get(listing.listingId) ?? listing.rowNumber;
}

function isPanelOnlySeatListing(
  listing: Listing,
  visualSeatIdsByListingId: Map<string, string[]>,
): boolean {
  return listing.isUnmapped === true && getVisualSeatIds(listing, visualSeatIdsByListingId).length === 0;
}

function shouldExpandPinsForSelection(selection: SelectionState): boolean {
  return !!selection.sectionId;
}

function getExpandedPinsDisplayMode(displayMode: DisplayMode, zoomedDisplay: DisplayMode): DisplayMode {
  return displayMode === 'sections' ? zoomedDisplay : displayMode;
}

function seatCentroid(
  seatIds: string[],
  coords: Map<string, [number, number]>,
): [number, number] | null {
  const pts = seatIds.map((id) => coords.get(id)).filter(Boolean) as [number, number][];
  if (!pts.length) return null;
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function getRowCenter(
  listing: Listing,
  sectionData: SectionManifestEntry,
  visualRowIdByListingId: Map<string, string | null>,
): [number, number] {
  const rowId = getVisualRowId(listing, visualRowIdByListingId);
  return rowId ? (sectionData.rows[rowId]?.center ?? sectionData.center) : sectionData.center;
}

function resolvePinLngLat({
  displayMode,
  listing,
  sectionData,
  seatCoords,
  visualSeatIdsByListingId,
  visualRowIdByListingId,
}: ResolvePinLngLatParams): [number, number] {
  if (displayMode === 'sections') return sectionData.center;
  if (displayMode === 'rows') return getRowCenter(listing, sectionData, visualRowIdByListingId);
  return seatCentroid(getVisualSeatIds(listing, visualSeatIdsByListingId), seatCoords)
    ?? getRowCenter(listing, sectionData, visualRowIdByListingId);
}

function createPinDataForListing(
  listing: Listing,
  visualSeatIdsByListingId: Map<string, string[]>,
  visualRowNumberByListingId: Map<string, number | null>,
): PinData {
  const visualSeatIds = getVisualSeatIds(listing, visualSeatIdsByListingId);
  return {
    listing,
    rowIndex: Math.max(0, (getVisualRowNumber(listing, visualRowNumberByListingId) ?? 1) - 1),
    seatIndex: visualSeatIds.length > 0
      ? Math.floor(visualSeatIds.length / 2)
      : 0,
  };
}

function markerZIndex(isHovered: boolean, isSelected: boolean): string {
  return isHovered ? '30' : isSelected ? '20' : '10';
}

function buildPinSelection(
  pin: PinRenderData,
  mode: DisplayMode,
  visualSeatIdsByListingId: Map<string, string[]>,
  visualRowIdByListingId: Map<string, string | null>,
): SelectionState {
  const rowId = getVisualRowId(pin.listing, visualRowIdByListingId);
  const seatIds = getVisualSeatIds(pin.listing, visualSeatIdsByListingId);
  switch (mode) {
    case 'sections':
      return buildSectionSelection(pin.sectionId);
    case 'rows':
      return rowId
        ? buildRowSelection(pin.sectionId, rowId)
        : buildSectionSelection(pin.sectionId);
    case 'seats':
      return buildListingSelection(
        pin.sectionId, pin.listing.listingId, seatIds, rowId,
      );
  }
}

function createMarkerEl({
  interactive,
  onClick,
}: {
  interactive: boolean;
  onClick?: (e: MouseEvent) => void;
}): { wrapper: HTMLDivElement; inner: HTMLDivElement } {
  const wrapper = document.createElement('div');
  // 0x0 anchor div — Pin's own translate(-50%, -100%) positions the arrow tip at the coordinate
  wrapper.style.cssText = `position: relative; width: 0; height: 0; cursor: ${interactive ? 'pointer' : 'default'};`;
  if (interactive && onClick) {
    wrapper.addEventListener('click', onClick);
  } else {
    wrapper.style.pointerEvents = 'none';
  }
  const inner = document.createElement('div');
  wrapper.appendChild(inner);
  return { wrapper, inner };
}

function upsertHoverPinMarker({
  current,
  map,
  pinData,
  interactive,
  onSelect,
  displayMode,
  seatColors,
  visualSeatIdsByListingId,
  visualRowIdByListingId,
}: {
  current: Map<string, MarkerEntry>;
  map: MapLibreMap;
  pinData: PinRenderData;
  interactive: boolean;
  onSelect: (selection: SelectionState) => void;
  displayMode: DisplayMode;
  seatColors: SeatColors;
  visualSeatIdsByListingId: Map<string, string[]>;
  visualRowIdByListingId: Map<string, string | null>;
}) {
  const existing = current.get(HOVER_PIN_ID);
  if (existing && existing.interactive !== interactive) {
    existing.marker.remove();
    setTimeout(() => existing.root.unmount(), 0);
    current.delete(HOVER_PIN_ID);
  }

  const reusable = current.get(HOVER_PIN_ID);
  if (reusable) {
    reusable.marker.setLngLat(pinData.lngLat);
    reusable.marker.getElement().style.display = '';
    renderPin(reusable.root, pinData.listing, true, false, seatColors);
    reusable.marker.getElement().style.zIndex = markerZIndex(true, false);
    reusable.isHovered = true;
    return;
  }

  const { wrapper, inner } = createMarkerEl({
    interactive,
    onClick: (e) => {
      e.stopPropagation();
      onSelect(buildPinSelection(pinData, displayMode, visualSeatIdsByListingId, visualRowIdByListingId));
    },
  });
  const root = createRoot(inner);
  renderPin(root, pinData.listing, true, false, seatColors);
  const marker = new Marker({ element: wrapper }).setLngLat(pinData.lngLat).addTo(map);
  marker.getElement().style.zIndex = markerZIndex(true, false);
  current.set(HOVER_PIN_ID, { marker, root, isHovered: true, isSelected: false, interactive });
}

function renderPin(
  root: Root,
  listing: Listing,
  isHovered: boolean,
  isSelected: boolean,
  seatColors: SeatColors,
): void {
  root.render(
    createElement(Pin, {
      x: 0,
      y: 0,
      price: listing.price,
      dealScore: listing.dealScore,
      isHovered,
      isSelected,
      defaultColor: seatColors.pinDefault,
      hoverColor: seatColors.pinHovered,
      pressedColor: seatColors.pinPressed,
      selectedColor: seatColors.pinSelected,
      seatViewUrl: listing.seatViewUrl,
      sectionLabel: listing.sectionLabel,
      rowNumber: listing.rowNumber,
      useTransition: true,
      interactive: true,
    }),
  );
}

export function useMapPins({
  mapRef,
  ready,
  model,
  sectionCenters,
  seatsUrl,
  selection,
  selectedListing,
  hoverState,
  displayMode,
  zoomedDisplay,
  seatColors,
  isMobile,
  pinDensity,
  onSelect,
  visualSeatIdsByListingId,
  visualRowIdByListingId,
  visualRowNumberByListingId,
}: UseMapPinsOptions): void {
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

  const [seatCoords, setSeatCoords] = useState<Map<string, [number, number]>>(new Map());

  useEffect(() => {
    if (!seatsUrl) return;
    fetch(seatsUrl)
      .then((r) => r.json())
      .then((geojson) => {
        const coords = new Map<string, [number, number]>();
        for (const f of geojson.features) {
          if (f.geometry?.type === 'Point' && f.properties?.id) {
            coords.set(f.properties.id, f.geometry.coordinates as [number, number]);
          }
        }
        setSeatCoords(coords);
      })
      .catch((err) => console.error('Failed to load seat coordinates:', err));
  }, [seatsUrl]);

  // Keep latest callbacks/colors in refs so marker click handlers never go stale
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const seatColorsRef = useRef(seatColors);
  seatColorsRef.current = seatColors;
  const displayModeRef = useRef(displayMode);
  displayModeRef.current = displayMode;
  const pinDataRef = useRef(new Map<string, PinRenderData>());

  // basePins: computes the static set of pins (no hover state).
  // Rebuilds only when model/displayMode/selection changes — NOT on hover transitions.
  const basePins = useMemo((): PinRenderData[] => {
    if (sectionCenters.size === 0) return [];

    const pins: PinRenderData[] = [];
    const { listingsBySection } = model;
    const expandSelectedSectionPins = shouldExpandPinsForSelection(selection);

    if (displayMode === 'sections' || displayMode === 'rows' || displayMode === 'seats') {
      // Collect candidates across the venue, then declutter them in venue space.
      const allCandidates: ResolvedPin[] = [];
      const sectionsToRender = listingsBySection;
      for (const [sectionId, sectionItems] of sectionsToRender) {
        const sectionData = sectionCenters.get(sectionId);
        if (!sectionData) continue;

        if (displayMode === 'seats') {
          const sectionListings = sectionItems as Listing[];
          for (const listing of sectionListings) {
            if (isPanelOnlySeatListing(listing, visualSeatIdsByListingId)) continue;
            const pin = createPinDataForListing(listing, visualSeatIdsByListingId, visualRowNumberByListingId);
            const lngLat = resolvePinLngLat({
              displayMode,
              listing,
              sectionData,
              seatCoords,
              visualSeatIdsByListingId,
              visualRowIdByListingId,
            });
            allCandidates.push({
              pin,
              x: lngLat[0],
              y: lngLat[1],
              sectionId,
            });
          }
          continue;
        }

        const bestDealListing = getBestDealListingWithMinScoreFallback(sectionItems as Listing[]);
        if (!bestDealListing || (displayMode !== 'sections' && getVisualRowId(bestDealListing, visualRowIdByListingId) === null)) continue;
        const bestDeal = createPinDataForListing(bestDealListing, visualSeatIdsByListingId, visualRowNumberByListingId);
        const lngLat = resolvePinLngLat({
          displayMode,
          listing: bestDeal.listing,
          sectionData,
          seatCoords,
          visualSeatIdsByListingId,
          visualRowIdByListingId,
        });
        allCandidates.push({
          pin: bestDeal,
          x: lngLat[0],
          y: lngLat[1],
          sectionId,
        });
      }
      const decluttered = displayMode === 'seats'
        ? splitSeatModePins(
          allCandidates,
          selection.sectionId,
          pinDensity.seatsBackground,
          isMobile,
          MAPLIBRE_DECLUTTER_BASE_DISTANCE,
        )
        : declutterPins(
          allCandidates,
          displayMode,
          displayMode === 'sections' ? pinDensity.sections : pinDensity.rows,
          isMobile,
          MAPLIBRE_DECLUTTER_BASE_DISTANCE,
        );
      for (const { pin, x, y, sectionId } of decluttered) {
        const isSelected = selectedListing?.listingId === pin.listing.listingId;
        pins.push({ listingId: pin.listing.listingId, lngLat: [x, y], sectionId, listing: pin.listing, isHovered: false, isSelected });
      }
    }

    if (expandSelectedSectionPins && selection.sectionId) {
      const sectionData = sectionCenters.get(selection.sectionId);
      const sectionListings = model.listingsBySection.get(selection.sectionId) ?? [];
      const expandedPinsDisplayMode = getExpandedPinsDisplayMode(displayMode, zoomedDisplay);

      if (sectionData) {
        for (const listing of sectionListings) {
          if (expandedPinsDisplayMode !== 'sections' && getVisualRowId(listing, visualRowIdByListingId) === null) continue;
          if (expandedPinsDisplayMode === 'seats' && isPanelOnlySeatListing(listing, visualSeatIdsByListingId)) continue;
          if (pins.some((pin) => pin.listingId === listing.listingId)) continue;
          const lngLat = resolvePinLngLat({
            displayMode: expandedPinsDisplayMode,
            listing,
            sectionData,
            seatCoords,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          pins.push({
            listingId: listing.listingId,
            lngLat,
            sectionId: selection.sectionId,
            listing,
            isHovered: false,
            isSelected: selectedListing?.listingId === listing.listingId,
          });
        }
      }
    }

    // If the selected listing has no default pin, add it as a selected overlay
    if (
      selectedListing
      && (displayMode === 'sections' || getVisualRowId(selectedListing, visualRowIdByListingId) !== null)
      && !(displayMode === 'seats' && isPanelOnlySeatListing(selectedListing, visualSeatIdsByListingId))
      && !pins.some((p) => p.listingId === selectedListing.listingId)
    ) {
      const sectionData = sectionCenters.get(selectedListing.sectionId);
      if (sectionData) {
        const lngLat = resolvePinLngLat({
          displayMode,
          listing: selectedListing,
          sectionData,
          seatCoords,
          visualSeatIdsByListingId,
          visualRowIdByListingId,
        });
        pins.push({
          listingId: selectedListing.listingId,
          lngLat,
          sectionId: selectedListing.sectionId,
          listing: selectedListing,
          isHovered: false,
          isSelected: true,
        });
      }
    }

    // Mobile: show roughly 2/3 of pins; declutter already uses 3x distance so remaining pins are well-spaced
    return isMobile ? pins.slice(0, Math.ceil(pins.length * 2 / 3)) : pins;
  }, [model, sectionCenters, displayMode, zoomedDisplay, selectedListing, selection, isMobile, seatCoords, pinDensity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers to basePins (create/remove/update) — does NOT manage hover state.
  useEffect(() => {
    const current = markersRef.current;

    if (!ready || !mapRef.current) {
      // Clean up all markers when map is not ready.
      // Defer root.unmount() to avoid "synchronously unmount during render" warning.
      for (const { marker, root } of current.values()) {
        marker.remove();
        setTimeout(() => root.unmount(), 0);
      }
      current.clear();
      return;
    }

    const map = mapRef.current;
    const nextIds = new Set(basePins.map((p) => p.listingId));

    // Remove stale markers (but preserve the on-the-fly hover pin)
    for (const [id, entry] of current) {
      if (id === HOVER_PIN_ID) continue;
      if (!nextIds.has(id)) {
        entry.marker.remove();
        setTimeout(() => entry.root.unmount(), 0);
        current.delete(id);
      }
    }

    // Add new markers or update isSelected on existing ones
    for (const pin of basePins) {
      const existing = current.get(pin.listingId);
      if (existing) {
        // Update position — lngLat changes when displayMode transitions
        // (e.g. section center → row center)
        existing.marker.setLngLat(pin.lngLat);
        if (existing.isSelected !== pin.isSelected) {
          renderPin(existing.root, pin.listing, existing.isHovered, pin.isSelected, seatColorsRef.current);
          existing.marker.getElement().style.zIndex = markerZIndex(existing.isHovered, pin.isSelected);
          existing.isSelected = pin.isSelected;
        }
      } else {
        const pinId = pin.listingId;
        const { wrapper, inner } = createMarkerEl((e) => {
          e.stopPropagation();
          const data = pinDataRef.current.get(pinId);
          if (!data) return;
          onSelectRef.current(buildPinSelection(
            data,
            displayModeRef.current,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          ));
        });
        const root = createRoot(inner);
        renderPin(root, pin.listing, false, pin.isSelected, seatColorsRef.current);
        const marker = new Marker({ element: wrapper }).setLngLat(pin.lngLat).addTo(map);
        marker.getElement().style.zIndex = markerZIndex(false, pin.isSelected);
        current.set(pin.listingId, { marker, root, isHovered: false, isSelected: pin.isSelected, interactive: true });
      }
    }

    // Keep pinDataRef in sync so click handlers can look up current pin data
    const nextPinData = new Map<string, PinRenderData>();
    for (const pin of basePins) nextPinData.set(pin.listingId, pin);
    const hoverEntry = pinDataRef.current.get(HOVER_PIN_ID);
    if (hoverEntry) nextPinData.set(HOVER_PIN_ID, hoverEntry);
    pinDataRef.current = nextPinData;
  }, [ready, basePins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Index basePins by listingId for O(1) lookup in the hover effect.
  const basePinsById = useMemo(() => {
    const m = new Map<string, PinRenderData>();
    for (const pin of basePins) m.set(pin.listingId, pin);
    return m;
  }, [basePins]);

  // Hover effect: applies isHovered imperatively on existing markers (re-renders 1-2 pins
  // max per transition) and manages the on-the-fly hover pin for rows with no static pin.
  useEffect(() => {
    const current = markersRef.current;
    if (!ready || !mapRef.current) return;

    // Update isHovered on existing static markers
    for (const [id, entry] of current) {
      if (id === HOVER_PIN_ID) continue;
      const pin = basePinsById.get(id);
      if (!pin) continue;
      const isHovered =
        displayMode === 'sections'
          ? hoverState.sectionId === pin.sectionId
          : displayMode === 'rows'
            ? getVisualRowId(pin.listing, visualRowIdByListingId) !== null
              && hoverState.sectionId === pin.sectionId
              && hoverState.rowId === getVisualRowId(pin.listing, visualRowIdByListingId)
            : hoverState.listingId === pin.listingId;
      if (entry.isHovered !== isHovered) {
        renderPin(entry.root, pin.listing, isHovered, entry.isSelected, seatColorsRef.current);
        entry.marker.getElement().style.zIndex = markerZIndex(isHovered, entry.isSelected);
        entry.isHovered = isHovered;
      }
    }

    // On-the-fly hover pin: show cheapest listing for a hovered section/row that has no static pin
    if (hoverState.sectionId !== null && mapRef.current) {
      const sectionData = sectionCenters.get(hoverState.sectionId);
      const hoveredListing = hoverState.listingId
        ? (model.listingsBySection.get(hoverState.sectionId) ?? []).find(
          (listing) => listing.listingId === hoverState.listingId,
        ) ?? null
        : null;
      const hoveredPanelOnlyListing = hoveredListing && isPanelOnlySeatListing(hoveredListing, visualSeatIdsByListingId)
        ? hoveredListing
        : null;

      if (displayMode === 'sections') {
        const alreadyHasPin = basePins.some((p) => p.sectionId === hoverState.sectionId);

        if (!alreadyHasPin && sectionData) {
          const sectionListings = model.listingsBySection.get(hoverState.sectionId) ?? [];
          if (sectionListings.length > 0) {
            const cheapest = sectionListings.reduce((a, b) => (a.price < b.price ? a : b));
            const lngLat: [number, number] = [sectionData.center[0], sectionData.center[1]];
            const hoverPinData: PinRenderData = {
              listingId: HOVER_PIN_ID, lngLat, sectionId: hoverState.sectionId!,
              listing: cheapest, isHovered: true, isSelected: false,
            };
            pinDataRef.current.set(HOVER_PIN_ID, hoverPinData);
            upsertHoverPinMarker({
              current,
              map: mapRef.current!,
              pinData: hoverPinData,
              interactive: true,
              onSelect: onSelectRef.current,
              displayMode: displayModeRef.current,
              seatColors: seatColorsRef.current,
              visualSeatIdsByListingId,
              visualRowIdByListingId,
            });
            return;
          }
        }
      }

      if (displayMode === 'rows' && hoverState.rowId !== null) {
        if (hoveredPanelOnlyListing && sectionData) {
          const lngLat = resolvePinLngLat({
            displayMode,
            listing: hoveredPanelOnlyListing,
            sectionData,
            seatCoords,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          const hoverPinData: PinRenderData = {
            listingId: HOVER_PIN_ID,
            lngLat,
            sectionId: hoverState.sectionId,
            listing: hoveredPanelOnlyListing,
            isHovered: true,
            isSelected: false,
          };
          pinDataRef.current.set(HOVER_PIN_ID, hoverPinData);
          upsertHoverPinMarker({
            current,
            map: mapRef.current!,
            pinData: hoverPinData,
            interactive: false,
            onSelect: onSelectRef.current,
            displayMode: displayModeRef.current,
            seatColors: seatColorsRef.current,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          return;
        }

        const alreadyHasPin = basePins.some(
          (p) => p.sectionId === hoverState.sectionId
            && getVisualRowId(p.listing, visualRowIdByListingId) === hoverState.rowId,
        );

        if (!alreadyHasPin && sectionData) {
          const rowListings = (model.listingsBySection.get(hoverState.sectionId) ?? []).filter(
            (l) => getVisualRowId(l, visualRowIdByListingId) === hoverState.rowId,
          );
          if (rowListings.length > 0) {
            const cheapest = rowListings.reduce((a, b) => (a.price < b.price ? a : b));
            const lngLat = resolvePinLngLat({
              displayMode,
              listing: cheapest,
              sectionData,
              seatCoords,
              visualSeatIdsByListingId,
              visualRowIdByListingId,
            });
            const hoverPinData: PinRenderData = {
              listingId: HOVER_PIN_ID, lngLat, sectionId: hoverState.sectionId!,
              listing: cheapest, isHovered: true, isSelected: false,
            };
            pinDataRef.current.set(HOVER_PIN_ID, hoverPinData);
            upsertHoverPinMarker({
              current,
              map: mapRef.current!,
              pinData: hoverPinData,
              interactive: true,
              onSelect: onSelectRef.current,
              displayMode: displayModeRef.current,
              seatColors: seatColorsRef.current,
              visualSeatIdsByListingId,
              visualRowIdByListingId,
            });
            return;
          }
        }
      }

      if (displayMode === 'seats' && hoverState.listingId !== null && sectionData) {
        if (hoveredPanelOnlyListing) {
          const lngLat = resolvePinLngLat({
            displayMode,
            listing: hoveredPanelOnlyListing,
            sectionData,
            seatCoords,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          const hoverPinData: PinRenderData = {
            listingId: HOVER_PIN_ID,
            lngLat,
            sectionId: hoverState.sectionId,
            listing: hoveredPanelOnlyListing,
            isHovered: true,
            isSelected: false,
          };
          pinDataRef.current.set(HOVER_PIN_ID, hoverPinData);
          upsertHoverPinMarker({
            current,
            map: mapRef.current!,
            pinData: hoverPinData,
            interactive: false,
            onSelect: onSelectRef.current,
            displayMode: displayModeRef.current,
            seatColors: seatColorsRef.current,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          return;
        }

        if (
          hoveredListing
          && !isPanelOnlySeatListing(hoveredListing, visualSeatIdsByListingId)
          && !basePinsById.has(hoveredListing.listingId)
        ) {
          const lngLat = resolvePinLngLat({
            displayMode,
            listing: hoveredListing,
            sectionData,
            seatCoords,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          const hoverPinData: PinRenderData = {
            listingId: HOVER_PIN_ID,
            lngLat,
            sectionId: hoverState.sectionId,
            listing: hoveredListing,
            isHovered: true,
            isSelected: false,
          };
          pinDataRef.current.set(HOVER_PIN_ID, hoverPinData);
          upsertHoverPinMarker({
            current,
            map: mapRef.current!,
            pinData: hoverPinData,
            interactive: true,
            onSelect: onSelectRef.current,
            displayMode: displayModeRef.current,
            seatColors: seatColorsRef.current,
            visualSeatIdsByListingId,
            visualRowIdByListingId,
          });
          return;
        }
      }
    }

    // No matching on-the-fly hover — hide the hover pin but keep the root alive
    // so it can be reused on the next hover without creating a new React root.
    const existing = current.get(HOVER_PIN_ID);
    if (existing) {
      existing.marker.getElement().style.display = 'none';
      existing.isHovered = false;
      pinDataRef.current.delete(HOVER_PIN_ID);
    }
  }, [hoverState, ready, basePinsById, displayMode, sectionCenters, model, seatCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove all markers on unmount
  useEffect(() => {
    return () => {
      for (const { marker, root } of markersRef.current.values()) {
        marker.remove();
        root.unmount();
      }
      markersRef.current.clear();
    };
  }, []);
}
