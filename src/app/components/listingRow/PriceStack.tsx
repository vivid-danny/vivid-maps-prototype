import { DealScorePill } from './DealScorePill';

/**
 * The listing row's right column: a fixed 110px lane holding the deal pill, the
 * fees disclosure and the price, right-aligned. Production puts "Fees Incl."
 * above the price so the disclosure is read as a qualifier on it.
 *
 * The row's border lives on this column (top, bottom, right) rather than on the
 * card, because the card's left edge is the zone accent bar.
 */
export function PriceStack({
  price,
  dealScore,
  borderColor,
}: {
  price: string;
  dealScore: number;
  borderColor: string;
}) {
  return (
    <div className="flex shrink-0 basis-[110px]">
      <div
        className="flex min-w-0 grow flex-col items-end justify-center overflow-hidden rounded-r-sm border-y border-r pr-2.5 transition-colors group-hover:border-ink-muted"
        style={{ borderColor }}
      >
        <DealScorePill score={dealScore} />
        <span className="whitespace-nowrap text-small text-ink-secondary">Fees Incl.</span>
        <span className="whitespace-nowrap text-body font-bold text-ink">
          {price}
          <span className="text-footnote font-bold text-ink-muted"> ea</span>
        </span>
      </div>
    </div>
  );
}
