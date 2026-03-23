import { useEffect, useRef, useMemo, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Pin } from '../../components/Pin';
import { buildSectionSelection } from '../behavior/rules';
import { getLowestPricePin, getLowestPricePinsByRow } from '../behavior/pins';
import type { SeatColors, DisplayMode, SelectionState, HoverState, Listing, SeatMapModel } from '../model/types';
import type { SectionManifestEntry } from './useVenueManifest';

interface UseMapPinsOptions {
  mapRef: React.RefObject<MapLibreMap | null>;
  ready: boolean;
  model: SeatMapModel;
  sectionCenters: Map<string, SectionManifestEntry>;
  selection: SelectionState;
  selectedListing: Listing | null;
  hoverState: HoverState;
  displayMode: DisplayMode;
  seatColors: SeatColors;
  isMobile: boolean;
  onSelect: (selection: SelectionState) => void;
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
}

// Sentinel ID for the on-the-fly hover pin (a row with no pre-existing pin candidate).
const HOVER_PIN_ID = '__hover__';

function markerZIndex(isHovered: boolean, isSelected: boolean): string {
  return isHovered ? '30' : isSelected ? '20' : '10';
}

function createMarkerEl(onClick: (e: MouseEvent) => void): { wrapper: HTMLDivElement; inner: HTMLDivElement } {
  const wrapper = document.createElement('div');
  // 0x0 anchor div — Pin's own translate(-50%, -100%) positions the arrow tip at the coordinate
  wrapper.style.cssText = 'position: relative; width: 0; height: 0; cursor: pointer;';
  wrapper.addEventListener('click', onClick);
  const inner = document.createElement('div');
  wrapper.appendChild(inner);
  return { wrapper, inner };
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
  selection,
  selectedListing,
  hoverState,
  displayMode,
  seatColors,
  isMobile,
  onSelect,
}: UseMapPinsOptions): void {
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());

  // Keep latest callbacks/colors in refs so marker click handlers never go stale
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const seatColorsRef = useRef(seatColors);
  seatColorsRef.current = seatColors;

  // basePins: computes the static set of pins (no hover state).
  // Rebuilds only when model/displayMode/selection changes — NOT on hover transitions.
  const basePins = useMemo((): PinRenderData[] => {
    if (sectionCenters.size === 0) return [];

    const pins: PinRenderData[] = [];
    const { pinsBySection } = model;

    for (const [sectionId, sectionPins] of pinsBySection) {
      const sectionData = sectionCenters.get(sectionId);
      if (!sectionData) continue;

      let candidates: Array<{ listing: Listing; lngLat: [number, number] }> = [];

      if (displayMode === 'sections') {
        const cheapest = getLowestPricePin(sectionPins);
        if (!cheapest) continue;
        candidates = [{ listing: cheapest.listing, lngLat: sectionData.center }];
      } else if (displayMode === 'rows') {
        for (const [, pin] of getLowestPricePinsByRow(sectionPins)) {
          const lngLat = sectionData.rows[pin.listing.rowId]?.center ?? sectionData.center;
          candidates.push({ listing: pin.listing, lngLat });
        }
      } else {
        // seats mode — show all pins from pinsBySection, positioned at their row center
        for (const pin of sectionPins) {
          const lngLat = sectionData.rows[pin.listing.rowId]?.center ?? sectionData.center;
          candidates.push({ listing: pin.listing, lngLat });
        }
      }

      for (const { listing, lngLat } of candidates) {
        const isSelected = selectedListing?.listingId === listing.listingId;
        pins.push({ listingId: listing.listingId, lngLat, sectionId, listing, isHovered: false, isSelected });
      }
    }

    // If the selected listing has no default pin, add it as a selected overlay
    if (selectedListing && !pins.some((p) => p.listingId === selectedListing.listingId)) {
      const sectionData = sectionCenters.get(selectedListing.sectionId);
      if (sectionData) {
        const lngLat = sectionData.rows[selectedListing.rowId]?.center ?? sectionData.center;
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

    // Mobile: show roughly half the pins to reduce clutter
    return isMobile ? pins.slice(0, Math.ceil(pins.length / 2)) : pins;
  }, [model, sectionCenters, displayMode, selectedListing, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers to basePins (create/remove/update) — does NOT manage hover state.
  useEffect(() => {
    const current = markersRef.current;

    if (!ready || !mapRef.current) {
      // Clean up all markers when map is not ready
      for (const { marker, root } of current.values()) {
        marker.remove();
        root.unmount();
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
        entry.root.unmount();
        current.delete(id);
      }
    }

    // Add new markers or update isSelected on existing ones
    for (const pin of basePins) {
      const existing = current.get(pin.listingId);
      if (existing) {
        if (existing.isSelected !== pin.isSelected) {
          renderPin(existing.root, pin.listing, existing.isHovered, pin.isSelected, seatColorsRef.current);
          existing.marker.getElement().style.zIndex = markerZIndex(existing.isHovered, pin.isSelected);
          existing.isSelected = pin.isSelected;
        }
      } else {
        const { wrapper, inner } = createMarkerEl((e) => {
          e.stopPropagation();
          onSelectRef.current(buildSectionSelection(pin.sectionId));
        });
        const root = createRoot(inner);
        renderPin(root, pin.listing, false, pin.isSelected, seatColorsRef.current);
        const marker = new Marker({ element: wrapper }).setLngLat(pin.lngLat).addTo(map);
        marker.getElement().style.zIndex = markerZIndex(false, pin.isSelected);
        current.set(pin.listingId, { marker, root, isHovered: false, isSelected: pin.isSelected });
      }
    }
  }, [ready, basePins]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hover effect: applies isHovered imperatively on existing markers (re-renders 1-2 pins
  // max per transition) and manages the on-the-fly hover pin for rows with no static pin.
  useEffect(() => {
    const current = markersRef.current;
    if (!ready || !mapRef.current) return;

    // Update isHovered on existing static markers
    for (const [id, entry] of current) {
      if (id === HOVER_PIN_ID) continue;
      const pin = basePins.find((p) => p.listingId === id);
      if (!pin) continue;
      const isHovered =
        displayMode === 'sections'
          ? hoverState.sectionId === pin.sectionId
          : hoverState.sectionId === pin.sectionId && hoverState.rowId === pin.listing.rowId;
      if (entry.isHovered !== isHovered) {
        renderPin(entry.root, pin.listing, isHovered, entry.isSelected, seatColorsRef.current);
        entry.marker.getElement().style.zIndex = markerZIndex(isHovered, entry.isSelected);
        entry.isHovered = isHovered;
      }
    }

    // On-the-fly hover pin: show cheapest listing for a hovered row that has no static pin
    if (
      (displayMode === 'rows' || displayMode === 'seats') &&
      hoverState.sectionId !== null &&
      hoverState.rowId !== null
    ) {
      const sectionData = sectionCenters.get(hoverState.sectionId);
      const alreadyHasPin = basePins.some(
        (p) => p.sectionId === hoverState.sectionId && p.listing.rowId === hoverState.rowId,
      );

      if (!alreadyHasPin && sectionData && mapRef.current) {
        const rowListings = (model.listingsBySection.get(hoverState.sectionId) ?? []).filter(
          (l) => l.rowId === hoverState.rowId,
        );
        if (rowListings.length > 0) {
          const cheapest = rowListings.reduce((a, b) => (a.price < b.price ? a : b));
          const lngLat = sectionData.rows[hoverState.rowId]?.center ?? sectionData.center;
          const existing = current.get(HOVER_PIN_ID);
          if (existing) {
            existing.marker.setLngLat(lngLat);
            renderPin(existing.root, cheapest, true, false, seatColorsRef.current);
            existing.isHovered = true;
          } else {
            const sectionId = hoverState.sectionId;
            const { wrapper, inner } = createMarkerEl((e) => {
              e.stopPropagation();
              onSelectRef.current(buildSectionSelection(sectionId));
            });
            const root = createRoot(inner);
            renderPin(root, cheapest, true, false, seatColorsRef.current);
            const marker = new Marker({ element: wrapper }).setLngLat(lngLat).addTo(mapRef.current);
            marker.getElement().style.zIndex = markerZIndex(true, false);
            current.set(HOVER_PIN_ID, { marker, root, isHovered: true, isSelected: false });
          }
          return; // on-the-fly pin placed — done
        }
      }
    }

    // No matching on-the-fly hover — remove stale hover pin if present
    const existing = current.get(HOVER_PIN_ID);
    if (existing) {
      existing.marker.remove();
      existing.root.unmount();
      current.delete(HOVER_PIN_ID);
    }
  }, [hoverState, ready, basePins, displayMode, sectionCenters, model]); // eslint-disable-line react-hooks/exhaustive-deps

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
