export type IconName =
  | 'search'
  | 'user'
  | 'info'
  | 'chevron-down'
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
 * Figma's "Masked Icon" for <Select>: an 8px-wide slot with the 20px chevron
 * box offset -8px, so the glyph sits tight against the label.
 */
export function SelectChevron() {
  return (
    <span aria-hidden className="relative h-5 w-2 shrink-0">
      <img
        src="/icons/chevron-down.svg"
        alt=""
        draggable={false}
        className="absolute left-[-5px] top-1/2 h-[14px] w-[14px] -translate-y-1/2"
      />
    </span>
  );
}
