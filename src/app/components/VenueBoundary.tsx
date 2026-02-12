import type { BoundaryConfig } from '../seatMap/model/types';

interface VenueBoundaryProps {
  config: BoundaryConfig;
}

export function VenueBoundary({ config }: VenueBoundaryProps) {
  const {
    path,
    viewBox,
    width,
    height,
    fill = 'white',
    stroke = '#A0A2B3',
    strokeWidth = 2,
  } = config;

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
      }}
    >
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
