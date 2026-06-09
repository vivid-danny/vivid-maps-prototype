import type { DisplayMode } from '../model/types';
import type { ThemeId } from '../config/themes';
import { THEME_IDS } from '../config/themes';
import { DEFAULT_SEAT_MAP_CONFIG } from '../config/defaults';

const DISPLAY_MODES: readonly DisplayMode[] = ['sections', 'rows', 'seats'];

const DEFAULTS = {
  initialDisplay: DEFAULT_SEAT_MAP_CONFIG.initialDisplay as DisplayMode,
  zoomedDisplay: DEFAULT_SEAT_MAP_CONFIG.zoomedDisplay as DisplayMode,
  theme: DEFAULT_SEAT_MAP_CONFIG.theme as ThemeId,
  showConnectors: DEFAULT_SEAT_MAP_CONFIG.showConnectors,
};

export interface UrlParamValues {
  initialDisplay?: DisplayMode;
  zoomedDisplay?: DisplayMode;
  theme?: ThemeId;
  showConnectors?: boolean;
}

function readUrlParams(): UrlParamValues {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: UrlParamValues = {};

  const initialDisplay = params.get('initialDisplay');
  if (initialDisplay && (DISPLAY_MODES as readonly string[]).includes(initialDisplay)) {
    result.initialDisplay = initialDisplay as DisplayMode;
  }

  const zoomedDisplay = params.get('zoomedDisplay');
  if (zoomedDisplay && (DISPLAY_MODES as readonly string[]).includes(zoomedDisplay)) {
    result.zoomedDisplay = zoomedDisplay as DisplayMode;
  }

  const theme = params.get('theme');
  if (theme && (THEME_IDS as readonly string[]).includes(theme)) {
    result.theme = theme as ThemeId;
  }

  const showConnectors = params.get('showConnectors');
  if (showConnectors === 'true' || showConnectors === 'false') {
    result.showConnectors = showConnectors === 'true';
  }

  return result;
}

export function syncToUrl(values: {
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  theme: ThemeId;
  showConnectors: boolean;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();

  if (values.initialDisplay !== DEFAULTS.initialDisplay) params.set('initialDisplay', values.initialDisplay);
  if (values.zoomedDisplay !== DEFAULTS.zoomedDisplay) params.set('zoomedDisplay', values.zoomedDisplay);
  if (values.theme !== DEFAULTS.theme) params.set('theme', values.theme);
  if (values.showConnectors !== DEFAULTS.showConnectors) params.set('showConnectors', String(values.showConnectors));

  const search = params.toString();
  const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState(null, '', newUrl);
}

export function clearUrlParams() {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
}

/** Returns URL params parsed once at module load time (stable across renders). */
export const INITIAL_URL_PARAMS: UrlParamValues = readUrlParams();
