import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export default component$<
  InboxSummaryProps &
    Omit<PropsOf<"section">, "folder" | "unread" | "flagged" | "signature" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ folder, unread, flagged, signature, class: className, style, ...attributes }) => {
  return (
    <section
      class={["inbox-summary", className]}
      aria-label="Inbox summary"
      style={style}
      {...attributes}
    >
      <h2>{folder || "Inbox"}</h2>
      <>{unread ? <p>{unread} unread</p> : null}</>
      <>{flagged ? <p>{flagged} flagged</p> : null}</>
      <>{unread > 0 && flagged > 0 ? <p>Some unread messages are flagged.</p> : null}</>
      <>{folder ? <p>Filed under {folder}</p> : null}</>
      {signature ? <p class="inbox-signature">{signature}</p> : null}
    </section>
  );
});
