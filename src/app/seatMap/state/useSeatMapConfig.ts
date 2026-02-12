import { useEffect, useState } from 'react';
import type { SeatColors } from '../model/types';
import type { SeatMapConfig } from '../config/types';

const STORAGE_KEY = 'seat-map-prototype-config';

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

    return {
      ...initialConfig,
      ...stored,
      seatColors: {
        ...initialConfig.seatColors,
        ...(stored.seatColors ?? {}),
      },
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const updateConfig = (updates: Partial<SeatMapConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
      seatColors: updates.seatColors
        ? { ...prev.seatColors, ...updates.seatColors }
        : prev.seatColors,
    }));
  };

  const updateSeatColor = (key: keyof SeatColors, value: string) => {
    setConfig((prev) => ({
      ...prev,
      seatColors: {
        ...prev.seatColors,
        [key]: value,
      },
    }));
  };

  const resetConfig = () => {
    setConfig(initialConfig);
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
