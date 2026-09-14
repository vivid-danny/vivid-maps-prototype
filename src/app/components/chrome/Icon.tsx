export type IconName =
  | 'search'
  | 'user'
  | 'info'
  | 'chevron-left'
  | 'plus'
  | 'minus'
  | 'filter'
  | 'sort';

interface IconProps {
  name: IconName;
  /** Outer box size (Figma icon containers are 20px, info is 18px). */
  size?: number;
  /** Glyph size inside the box. Defaults to Figma's 3px padding (size - 6). */
  glyph?: number;
  className?: string;
}

/**
 * Renders an exported Figma icon (public/icons/*.svg) inside a fixed box.
 * Glyphs are pre-colored #04092C (text/primary) in the export.
 */
export function Icon({ name, size = 20, glyph, className }: IconProps) {
  const g = glyph ?? size - 6;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <img src={`/icons/${name}.svg`} alt="" draggable={false} style={{ width: g, height: g }} />
    </span>
  );
}

/**
 * Chevron for <Select>-style chips. Drawn inline rather than loaded from
 * public/icons so it renders as a crisp stroked caret and inherits currentColor.
 */
export function SelectChevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3 shrink-0"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}
