import type { DeliveryInfo } from '../../seatMap/model/types';

interface TicketDetailDeliveryProps {
  delivery: DeliveryInfo;
}

export function TicketDetailDelivery({ delivery }: TicketDetailDeliveryProps) {
  return (
    <div className="p-6 border-t border-gray-100">
      <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Delivery
      </h4>
      <p className="text-sm font-medium text-gray-900">{delivery.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{delivery.description}</p>
    </div>
  );
}
