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
      <Show when={props.unread}>
        <p>{props.unread} unread</p>
      </Show>
      <Show when={props.flagged}>
        <p>{props.flagged} flagged</p>
      </Show>
      <Show when={props.unread > 0 && props.flagged > 0}>
        <p>Some unread messages are flagged.</p>
      </Show>
      <Show when={props.folder}>
        <p>Filed under {props.folder}</p>
      </Show>
      <Show when={props.signature}>
        <p class="inbox-signature">{props.signature}</p>
      </Show>
    </section>
  );
}
