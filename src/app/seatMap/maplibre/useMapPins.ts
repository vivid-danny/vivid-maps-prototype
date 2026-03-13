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

  // Compute the full set of pins to render, with their state
  const pinsToRender = useMemo((): PinRenderData[] => {
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
        const isHovered =
          displayMode === 'sections'
            ? hoverState.sectionId === sectionId
            : displayMode === 'rows'
              ? hoverState.sectionId === sectionId && hoverState.rowId === listing.rowId
              : hoverState.listingId === listing.listingId;
        const isSelected = selectedListing?.listingId === listing.listingId;

        pins.push({ listingId: listing.listingId, lngLat, sectionId, listing, isHovered, isSelected });
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
  }, [model, sectionCenters, displayMode, hoverState, selectedListing, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers to pinsToRender (create/remove/update)
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
    const nextIds = new Set(pinsToRender.map((p) => p.listingId));

    // Remove stale markers
    for (const [id, entry] of current) {
      if (!nextIds.has(id)) {
        entry.marker.remove();
        entry.root.unmount();
        current.delete(id);
      }
    }

    // Add new markers or update state on existing ones
    for (const pin of pinsToRender) {
      const existing = current.get(pin.listingId);
      if (existing) {
        if (existing.isHovered !== pin.isHovered || existing.isSelected !== pin.isSelected) {
          renderPin(existing.root, pin.listing, pin.isHovered, pin.isSelected, seatColorsRef.current);
          existing.isHovered = pin.isHovered;
          existing.isSelected = pin.isSelected;
        }
      } else {
        const { wrapper, inner } = createMarkerEl((e) => {
          e.stopPropagation();
          onSelectRef.current(buildSectionSelection(pin.sectionId));
        });
        const root = createRoot(inner);
        renderPin(root, pin.listing, pin.isHovered, pin.isSelected, seatColorsRef.current);
        const marker = new Marker({ element: wrapper }).setLngLat(pin.lngLat).addTo(map);
        current.set(pin.listingId, { marker, root, isHovered: pin.isHovered, isSelected: pin.isSelected });
      }
    }
  }, [ready, pinsToRender]); // eslint-disable-line react-hooks/exhaustive-deps

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
