export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default function InboxSummary({ folder, unread, flagged, signature }: InboxSummaryProps) {
  return (
    <section className="inbox-summary" aria-label="Inbox summary">
      <h2>{folder || "Inbox"}</h2>
      {unread ? <p>{unread} unread</p> : null}
      {flagged ? <p>{flagged} flagged</p> : null}
      {unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}
      {folder ? <p>Filed under {folder}</p> : null}
      {signature ? <p className="inbox-signature">{signature}</p> : null}
    </section>
  );
}
