import { useEffect, useState } from 'react';

interface VenueManifest {
  seatableIds: string[];
}

export function useVenueManifest(manifestUrl: string): VenueManifest {
  const [seatableIds, setSeatableIds] = useState<string[]>([]);

  useEffect(() => {
    if (!manifestUrl) return;
    fetch(manifestUrl)
      .then((r) => r.json())
      .then((manifest) => {
        setSeatableIds(Object.keys(manifest.sections ?? {}));
      })
      .catch((err) => console.error('Failed to load venue manifest:', err));
  }, [manifestUrl]);

  return { seatableIds };
}
