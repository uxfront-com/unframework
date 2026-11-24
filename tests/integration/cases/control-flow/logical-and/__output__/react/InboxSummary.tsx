import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export type InboxSummaryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "folder" | "unread" | "flagged" | "signature" | "children"
>;

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
      {...attributes}
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
