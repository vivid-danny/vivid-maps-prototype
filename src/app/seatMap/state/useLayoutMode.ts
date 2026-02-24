import { useEffect, useState } from 'react';
import type { LayoutMode } from '../model/types';
import type { LayoutModeOverride } from '../config/types';

export function useLayoutMode(override: LayoutModeOverride): LayoutMode {
  const getViewportMode = (): LayoutMode =>
    window.matchMedia('(max-width: 800px)').matches ? 'mobile' : 'desktop';

  const [viewportMode, setViewportMode] = useState<LayoutMode>(getViewportMode);

  useEffect(() => {
    if (override !== 'auto') return;
    const mq = window.matchMedia('(max-width: 800px)');
    const handler = (e: MediaQueryListEvent) =>
      setViewportMode(e.matches ? 'mobile' : 'desktop');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [override]);

  return override === 'auto' ? viewportMode : override;
}
