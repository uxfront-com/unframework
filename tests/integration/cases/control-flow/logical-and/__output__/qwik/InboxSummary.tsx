import { component$ } from "@qwik.dev/core";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default component$<InboxSummaryProps>(({ folder, unread, flagged, signature }) => {
  return (
    <section class="inbox-summary" aria-label="Inbox summary">
      <h2>{folder || "Inbox"}</h2>
      {unread ? <p>{unread} unread</p> : null}
      {flagged ? <p>{flagged} flagged</p> : null}
      {unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}
      {folder ? <p>Filed under {folder}</p> : null}
      {signature ? <p class="inbox-signature">{signature}</p> : null}
    </section>
  );
});
