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
}: InboxSummaryProps & InboxSummaryAttributes) {
  return (
    <section className={cx("inbox-summary", className)} aria-label="Inbox summary" style={style}>
      <h2>{folder || "Inbox"}</h2>
      {unread ? <p>{unread} unread</p> : null}
      {flagged ? <p>{flagged} flagged</p> : null}
      {unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}
      {folder ? <p>Filed under {folder}</p> : null}
      {signature ? <p className="inbox-signature">{signature}</p> : null}
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
