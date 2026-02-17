import type { Perk } from '../../seatMap/model/types';
import { PERK_LABELS } from '../../seatMap/behavior/utils';

interface TicketDetailPerksProps {
  perks: Perk[];
}

const PERK_DESCRIPTIONS: Record<Perk, string> = {
  aisle: 'Seats are located on the aisle for easy access.',
  front_of_section: 'Front row of the section with unobstructed views.',
  ada_accessible: 'ADA accessible seating with companion seats available.',
  food_and_drink: 'Includes complimentary food and beverages.',
  super_seller: 'Sold by a trusted, high-volume seller.',
  vip: 'VIP experience with premium amenities and exclusive access.',
};

export function TicketDetailPerks({ perks }: TicketDetailPerksProps) {
  if (perks.length === 0) return null;

  return (
    <div className="p-6 border-t border-gray-100">
      <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
        Seat Perks
      </h4>
      <div className="mt-2 space-y-2">
        {perks.map((perk) => (
          <div key={perk}>
            <p className="text-sm font-medium text-gray-900">{PERK_LABELS[perk]}</p>
            <p className="text-xs text-gray-500">{PERK_DESCRIPTIONS[perk]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
