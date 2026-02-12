interface StageProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Original SVG viewBox dimensions
const ORIGINAL_WIDTH = 131;
const ORIGINAL_HEIGHT = 125;

// Stage polygon path (from provided SVG)
const STAGE_PATH = "M67.6375 123.304C66.2383 124.316 64.3476 124.316 62.9485 123.304L1.65582 78.9636C0.247829 77.945 -0.34142 76.1339 0.197673 74.4818L23.6024 2.7591C24.1394 1.11347 25.674 0 27.405 0L103.181 0C104.912 0 106.447 1.11346 106.984 2.75909L130.388 74.4818C130.927 76.1339 130.338 77.945 128.93 78.9636L67.6375 123.304Z";

// Static stage component - custom polygon shape with label
// Non-interactive (no hover/click states)
export function Stage({ x, y, width, height }: StageProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${ORIGINAL_WIDTH} ${ORIGINAL_HEIGHT}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        pointerEvents: 'none',
      }}
    >
      <path
        d={STAGE_PATH}
        fill="#04092C"
      />
      <text
        x={ORIGINAL_WIDTH / 2}
        y={ORIGINAL_HEIGHT * 0.4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={14}
        fontWeight="bold"
        style={{ userSelect: 'none' }}
      >
        STAGE
      </text>
    </svg>
  );
}
