import { type JSX, Show } from "solid-js";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default function InboxSummary(
  props: InboxSummaryProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `inbox-summary ${props.class}` : "inbox-summary"}
      aria-label="Inbox summary"
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
