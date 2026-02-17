import { useState } from 'react';

interface TicketDetailCheckoutProps {
  quantityAvailable: number;
  className?: string;
}

export function TicketDetailCheckout({ quantityAvailable, className = '' }: TicketDetailCheckoutProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className={`flex items-center gap-3 p-6 ${className}`}>
      <select
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="w-1/2 h-10 px-3 rounded border border-gray-300 bg-white text-sm text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-pink-500"
      >
        {Array.from({ length: quantityAvailable }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n} {n === 1 ? 'Ticket' : 'Tickets'}
          </option>
        ))}
      </select>
      <button className="w-1/2 h-10 rounded bg-[#D63384] hover:bg-[#C22575] active:bg-[#A91D63] text-white text-sm font-semibold cursor-pointer transition-colors">
        Checkout
      </button>
    </div>
  );
}
