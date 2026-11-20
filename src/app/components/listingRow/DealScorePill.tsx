import type { CSSProperties } from 'react';

/**
 * The deal-score chip in the row's right column, reading "<score> <word>".
 * Below 6.0 production shows nothing at all, which is also the gate both
 * prototypes used for their old green badge.
 *
 * Only a perfect 10.0 earns the branded gradient. Everything else is green, and
 * the green goes quiet below 8.0 so a strong score still reads as the loudest
 * thing in the lane.
 */
const PILL_GRADIENT = 'linear-gradient(in oklab 73deg, #CE3197 0%, #00EAF2 122.43%)';

function dealWord(score: number): string {
  if (score >= 9) return 'Fantastic';
  if (score >= 8) return 'Great';
  if (score >= 7) return 'Very Good';
  return 'Good';
}

function pillStyle(score: number): CSSProperties {
  if (score >= 10) return { backgroundImage: PILL_GRADIENT, color: '#FFFFFF' };
  if (score >= 8) return { backgroundColor: '#008442', color: '#FFFFFF' };
  return { backgroundColor: '#E6FFED', color: '#4AC76D' };
}

export function DealScorePill({ score }: { score: number }) {
  if (score < 6) return null;

  return (
    <span
      className="flex h-[18px] w-fit shrink-0 items-center whitespace-nowrap rounded-[2px] px-1 text-caption font-medium leading-none"
      style={pillStyle(score)}
    >
      {score.toFixed(1)} {dealWord(score)}
    </span>
  );
}
