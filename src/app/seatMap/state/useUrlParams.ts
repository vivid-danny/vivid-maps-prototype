import type { DisplayMode } from '../model/types';
import type { ThemeId } from '../config/themes';
import { THEME_IDS } from '../config/themes';

const DISPLAY_MODES: readonly DisplayMode[] = ['sections', 'rows', 'seats'];

const DEFAULTS = {
  initialDisplay: 'sections' as DisplayMode,
  zoomedDisplay: 'seats' as DisplayMode,
  theme: 'branded' as ThemeId,
};

export interface UrlParamValues {
  initialDisplay?: DisplayMode;
  zoomedDisplay?: DisplayMode;
  theme?: ThemeId;
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

  return result;
}

export function syncToUrl(values: {
  initialDisplay: DisplayMode;
  zoomedDisplay: DisplayMode;
  theme: ThemeId;
}) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();

  if (values.initialDisplay !== DEFAULTS.initialDisplay) params.set('initialDisplay', values.initialDisplay);
  if (values.zoomedDisplay !== DEFAULTS.zoomedDisplay) params.set('zoomedDisplay', values.zoomedDisplay);
  if (values.theme !== DEFAULTS.theme) params.set('theme', values.theme);

  const search = params.toString();
  const newUrl = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  window.history.replaceState(null, '', newUrl);
}

/** Returns URL params parsed once at module load time (stable across renders). */
export const INITIAL_URL_PARAMS: UrlParamValues = readUrlParams();
