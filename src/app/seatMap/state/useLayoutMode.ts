import { useEffect, useState } from 'react';
import type { LayoutMode } from '../model/types';

export function useLayoutMode(): LayoutMode {
  const getViewportMode = (): LayoutMode =>
    window.matchMedia('(max-width: 800px)').matches ? 'mobile' : 'desktop';

  const [viewportMode, setViewportMode] = useState<LayoutMode>(getViewportMode);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const handler = (e: MediaQueryListEvent) =>
      setViewportMode(e.matches ? 'mobile' : 'desktop');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return viewportMode;
}
