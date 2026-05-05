import type { EventInfo } from '../seatMap/model/types';

interface EventHeaderProps {
  eventInfo: EventInfo;
}

export function EventHeader({ eventInfo }: EventHeaderProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white border-b border-[#d3d3dc] shrink-0">
      <div className="flex gap-4 items-center w-full">
        <div className="flex flex-1 flex-col items-start justify-center min-w-0">
          <p className="text-[16px] font-bold leading-6 text-[#04092c] overflow-hidden text-ellipsis whitespace-nowrap w-full">
            {eventInfo.eventName}
          </p>
          <div className="flex gap-[2px] items-center text-[14px] leading-[21px] text-[#474b5e] whitespace-nowrap">
            <span>{eventInfo.eventDate}</span>
          </div>
        </div>
        <div className="shrink-0 size-[48px] rounded-[3px] bg-[#0e3386] overflow-hidden flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
      </div>
    </div>
  );
}
