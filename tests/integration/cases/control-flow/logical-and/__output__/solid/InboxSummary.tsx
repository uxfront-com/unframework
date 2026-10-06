import { Show } from "solid-js";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default function InboxSummary(props: InboxSummaryProps) {
  return (
    <section class="inbox-summary" aria-label="Inbox summary">
      <h2>{props.folder || "Inbox"}</h2>
      <Show keyed when={props.unread}>
        {(unread) => <p>{unread} unread</p>}
      </Show>
      <Show keyed when={props.flagged}>
        {(flagged) => <p>{flagged} flagged</p>}
      </Show>
      <Show when={props.unread > 0 && props.flagged > 0}>
        <p>Some unread messages are flagged.</p>
      </Show>
      <Show keyed when={props.folder}>
        {(folder) => <p>Filed under {folder}</p>}
      </Show>
      <Show keyed when={props.signature}>
        {(signature) => <p class="inbox-signature">{signature}</p>}
      </Show>
    </section>
  );
}
