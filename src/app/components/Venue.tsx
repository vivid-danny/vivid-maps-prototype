import type { ReactNode } from 'react';
import { VenueBoundary } from "./VenueBoundary";
import type { BoundaryConfig } from "../seatMap/model/types";

interface VenueProps {
  children: ReactNode;
  boundary?: BoundaryConfig;
}

export function Venue({ children, boundary }: VenueProps) {
  // Use boundary dimensions if provided, otherwise fallback to default
  const width = boundary ? boundary.width : 310;
  const height = boundary ? boundary.height : 300;

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: boundary ? 'transparent' : '#FFFFFF',
        border: boundary ? 'none' : '1px solid #F0F0F0',
        position: 'relative',
        borderRadius: '2px',
      }}
    >
      {boundary && <VenueBoundary config={boundary} />}
      {children}
    </div>
  );
}
