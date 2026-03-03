import { useEffect, useState } from 'react';
import type { SeatColors } from '../model/types';
import type { SeatMapConfig } from '../config/types';
import { THEMES, THEME_IDS } from '../config/themes';
import type { ThemeId } from '../config/themes';

const STORAGE_KEY = 'seat-map-prototype-config';
const VALID_THEME_IDS: readonly string[] = THEME_IDS;

function readStoredConfig(): Partial<SeatMapConfig> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function useSeatMapConfig(initialConfig: SeatMapConfig) {
  const [config, setConfig] = useState<SeatMapConfig>(() => {
    const stored = readStoredConfig();
    if (!stored) return initialConfig;

    // Migration: discard pinDensity if it's not the current object shape
    if (stored.pinDensity !== undefined && typeof stored.pinDensity !== 'object') {
      delete stored.pinDensity;
    }

    // Theme migration
    if (!stored.theme || !VALID_THEME_IDS.includes(stored.theme as ThemeId)) {
      stored.theme = 'branded';
    }

    // ThemeOverrides migration
    if (!stored.themeOverrides || typeof stored.themeOverrides !== 'object') {
      stored.themeOverrides = stored.seatColors
        ? { branded: { ...initialConfig.seatColors, ...stored.seatColors } }
        : {};
    }

    // Derive seatColors from theme + overrides (ignore any stale stored seatColors)
    const theme = stored.theme as ThemeId;
    const seatColors = (stored.themeOverrides as Record<string, SeatColors>)[theme] ?? THEMES[theme];

    return {
      ...initialConfig,
      ...stored,
      seatColors,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const updateConfig = (updates: Partial<SeatMapConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };

      if (updates.theme !== undefined && updates.theme !== prev.theme) {
        // Theme switch: load colors from overrides (if customized) or theme defaults
        next.seatColors = next.themeOverrides?.[updates.theme] ?? THEMES[updates.theme];
      } else if (updates.seatColors) {
        // Color picker change: merge into seatColors AND save to themeOverrides
        next.seatColors = { ...prev.seatColors, ...updates.seatColors };
        next.themeOverrides = {
          ...prev.themeOverrides,
          [prev.theme]: next.seatColors,
        };
      }

      return next;
    });
  };

  const updateSeatColor = (key: keyof SeatColors, value: string) => {
    setConfig((prev) => {
      const newSeatColors = { ...prev.seatColors, [key]: value };
      return {
        ...prev,
        seatColors: newSeatColors,
        themeOverrides: {
          ...prev.themeOverrides,
          [prev.theme]: newSeatColors,
        },
      };
    });
  };

  const resetConfig = () => {
    setConfig((prev) => ({
      ...initialConfig,
      theme: prev.theme,
      themeOverrides: {},
      seatColors: THEMES[prev.theme],
    }));
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return {
    config,
    setConfig,
    updateConfig,
    updateSeatColor,
    resetConfig,
  };
}
