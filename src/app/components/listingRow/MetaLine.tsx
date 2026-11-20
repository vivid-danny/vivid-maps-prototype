import { Fragment } from 'react';

/**
 * The row's second line: "Row GA | 1-4 tickets | ...". Production bolds the row
 * and separates the parts with a muted pipe. Parts that are unknown are dropped
 * entirely rather than rendered as a placeholder — rows in particular are often
 * missing, and an empty "Row" reads as a claim we can't make.
 */
export function MetaLine({ parts }: { parts: Array<{ text: string; bold?: boolean } | null> }) {
  const shown = parts.filter((part): part is { text: string; bold?: boolean } => part !== null);

  return (
    <p className="truncate text-caption text-ink">
      {shown.map((part, index) => (
        <Fragment key={part.text}>
          {index > 0 && <span className="text-[#A0A2B3]"> | </span>}
          <span className={part.bold ? 'font-bold' : undefined}>{part.text}</span>
        </Fragment>
      ))}
    </p>
  );
}
