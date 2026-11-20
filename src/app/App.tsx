import { SeatMapRoot } from './seatMap/components/SeatMapRoot';
import { ZoneInventoryRoot } from './zoneInventory/ZoneInventoryRoot';
import { Agentation } from "agentation";

/**
 * Two prototypes share one entry point. The zone-inventory prototype lives at
 * /zones (or ?prototype=zones) so the existing seat map is untouched.
 */
function isZonePrototype(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search } = window.location;
  return pathname.replace(/\/+$/, '') === '/zones'
    || new URLSearchParams(search).get('prototype') === 'zones';
}

export default function App() {
  return (
    <>
      {isZonePrototype() ? <ZoneInventoryRoot /> : <SeatMapRoot />}
      {import.meta.env.DEV ? <Agentation /> : null}
    </>
  );
}
