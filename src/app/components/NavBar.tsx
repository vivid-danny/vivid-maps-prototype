import { Menu, Search } from 'lucide-react';
import type { EventInfo } from '../seatMap/model/types';

interface NavBarProps {
  eventInfo: EventInfo;
}

export function NavBar({ eventInfo }: NavBarProps) {
  return (
    <div className="shrink-0 bg-white border-b border-[#efeff6] z-10">
      {/* Promo banner */}
      <div className="bg-[#04092C] text-white text-xs text-center py-1.5 px-4">
        100 million sold, 100% Buyer Guarantee.{' '}
        <span className="underline cursor-pointer">Learn More.</span>
      </div>

      {/* Main nav */}
      <div className="min-h-[76px] flex items-center justify-between px-6 py-4">
        {/* Left: Logo + Search */}
        <div className="flex items-center gap-[40px]">
          {/* Logo */}
          <img src="/logo.svg" alt="Vivid Seats" className="shrink-0 h-7" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#717488] pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search by artist, team, or venue"
              className="w-[343px] h-10 pl-9 pr-3 text-[16px] text-[#717488] bg-[#f6f6fb] border border-transparent rounded-full placeholder:text-[#717488] cursor-default focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Production details + Menu */}
        <div className="flex items-center gap-6">
          {/* Production details */}
          <div className="flex items-center gap-4 border-l border-[#efeff6] pl-6">
            <div className="shrink-0 size-[48px] rounded-[4px] bg-[#0e3386] overflow-hidden flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <div className="flex flex-col items-start justify-center">
              <p className="font-bold text-[16px] leading-6 text-[#04092c] whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px]">
                {eventInfo.eventName}
              </p>
              <div className="flex gap-1 items-center text-[14px] leading-[21px] text-[#474b5e] whitespace-nowrap">
                <span>{eventInfo.venueName}</span>
                <span>•</span>
                <span>{eventInfo.eventDate}</span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <button className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100" aria-label="Menu">
            <Menu className="w-5 h-5 text-[#04092C]" />
          </button>
        </div>
      </div>
    </div>
  );
}
