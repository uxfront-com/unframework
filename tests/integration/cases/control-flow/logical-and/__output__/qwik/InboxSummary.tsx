import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default component$<InboxSummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ folder, unread, flagged, signature, class: className, style, ...attributes }) => {
    return (
      <section
        class={["inbox-summary", className]}
        aria-label="Inbox summary"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>{folder || "Inbox"}</h2>
        <>{unread ? <p>{unread} unread</p> : null}</>
        <>{flagged ? <p>{flagged} flagged</p> : null}</>
        <>{unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}</>
        <>{folder ? <p>Filed under {folder}</p> : null}</>
        {signature ? <p class="inbox-signature">{signature}</p> : null}
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
