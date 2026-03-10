// DOM mutation manager for hover/pressed state on SVG elements.
// Avoids React re-renders by directly setting/restoring attributes.

export interface MutationManager {
  applyHover(elements: Element[], attr: string, color: string): void;
  clearHover(): void;      // restore DOM + clear hover state
  applyPressed(elements: Element[], attr: string, color: string): void;
  clearPressed(): void;    // restore DOM + clear pressed state
  discardPressed(): void;  // clear pressed state WITHOUT restoring DOM
  discardAll(): void;      // clear all state WITHOUT restoring DOM
}

interface MutatedSlot {
  els: Element[];
  prevValues: string[];
  attr: string;
}

function applyMutation(slot: { val: MutatedSlot | null }, elements: Element[], attr: string, color: string): void {
  const prevValues = elements.map(el => el.getAttribute(attr) ?? '');
  for (const el of elements) el.setAttribute(attr, color);
  slot.val = { els: elements, prevValues, attr };
}

function restoreMutation(slot: { val: MutatedSlot | null }): void {
  const state = slot.val;
  if (!state) return;
  for (let i = 0; i < state.els.length; i++) {
    state.els[i].setAttribute(state.attr, state.prevValues[i]);
  }
  slot.val = null;
}

export function createMutationManager(): MutationManager {
  const hover = { val: null as MutatedSlot | null };
  const pressed = { val: null as MutatedSlot | null };

  return {
    applyHover(elements, attr, color) {
      applyMutation(hover, elements, attr, color);
    },
    clearHover() {
      restoreMutation(hover);
    },
    applyPressed(elements, attr, color) {
      applyMutation(pressed, elements, attr, color);
    },
    clearPressed() {
      restoreMutation(pressed);
    },
    discardPressed() {
      pressed.val = null;
    },
    discardAll() {
      hover.val = null;
      pressed.val = null;
    },
  };
}

/** Find all SVG elements matching a row polyline or listing seats+connectors */
export function findHoverTargets(wrapper: SVGGElement, dataset: DOMStringMap): { fills: Element[]; strokes: Element[] } {
  if (dataset.isRow || dataset.isZoneRow) {
    // Row polylines: stroke is the visual attr
    const selector = dataset.isRow
      ? `[data-row-id="${dataset.rowId}"][data-is-row]`
      : `[data-row-id="${dataset.rowId}"][data-is-zone-row]`;
    return { fills: [], strokes: Array.from(wrapper.querySelectorAll(selector)) };
  }
  if (dataset.listingId) {
    // Seats (circles → fill) and connectors (lines → stroke) sharing the same listing
    const all = Array.from(wrapper.querySelectorAll(`[data-listing-id="${dataset.listingId}"]`));
    const fills: Element[] = [];
    const strokes: Element[] = [];
    for (const el of all) {
      if (el.tagName === 'circle') fills.push(el);
      else if (el.tagName === 'line') strokes.push(el);
    }
    return { fills, strokes };
  }
  return { fills: [], strokes: [] };
}
