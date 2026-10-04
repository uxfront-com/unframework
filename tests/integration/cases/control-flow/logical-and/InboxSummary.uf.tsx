export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default function InboxSummary({ folder, unread, flagged, signature }: InboxSummaryProps) {
  return (
    <section class="inbox-summary" aria-label="Inbox summary">
      <h2>{folder || "Inbox"}</h2>
      {unread && <p>{unread} unread</p>}
      {flagged && <p>{flagged} flagged</p>}
      {unread > 0 && flagged > 0 && <p>Some unread messages are flagged.</p>}
      {folder && <p>Filed under {folder}</p>}
      {signature && <p class="inbox-signature">{signature}</p>}
    </section>
  );
}
