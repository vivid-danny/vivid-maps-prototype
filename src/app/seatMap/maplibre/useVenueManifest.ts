import { useEffect, useState } from 'react';

export interface SectionManifestEntry {
  center: [number, number]; // [lng, lat]
  rows: Record<string, { center: [number, number] }>;
}

interface VenueManifest {
  seatableIds: string[];
  sectionCenters: Map<string, SectionManifestEntry>;
}

const EMPTY: VenueManifest = { seatableIds: [], sectionCenters: new Map() };

export function useVenueManifest(manifestUrl: string): VenueManifest {
  const [result, setResult] = useState<VenueManifest>(EMPTY);

  useEffect(() => {
    if (!manifestUrl) return;
    fetch(manifestUrl)
      .then((r) => r.json())
      .then((manifest) => {
        const sections = manifest.sections ?? {};
        const seatableIds = Object.keys(sections);
        const sectionCenters = new Map<string, SectionManifestEntry>();
        for (const [id, data] of Object.entries(sections)) {
          const sec = data as Record<string, unknown>;
          const rawRows = (sec.rows ?? {}) as Record<string, Record<string, unknown>>;
          sectionCenters.set(id, {
            center: sec.center as [number, number],
            rows: Object.fromEntries(
              Object.entries(rawRows).map(([rowId, rowData]) => [
                rowId,
                { center: rowData.center as [number, number] },
              ]),
            ),
          });
        }
        setResult({ seatableIds, sectionCenters });
      })
      .catch((err) => console.error('Failed to load venue manifest:', err));
  }, [manifestUrl]);

  return result;
}
