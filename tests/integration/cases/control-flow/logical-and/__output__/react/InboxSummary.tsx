import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export interface InboxSummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function InboxSummary({
  folder,
  unread,
  flagged,
  signature,
  className,
  style,
  ...attributes
}: InboxSummaryProps & InboxSummaryAttributes) {
  return (
    <section
      className={cx("inbox-summary", className)}
      aria-label="Inbox summary"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{folder || "Inbox"}</h2>
      {unread ? <p>{unread} unread</p> : null}
      {flagged ? <p>{flagged} flagged</p> : null}
      {unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}
      {folder ? <p>Filed under {folder}</p> : null}
      {signature ? <p className="inbox-signature">{signature}</p> : null}
    </section>
  );
}
