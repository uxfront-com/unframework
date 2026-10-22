import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export default component$<MessageListProps & { class?: ClassList; style?: CSSProperties }>(
  ({
    messages,
    archived = [],
    emptyText = "Nothing here yet.",
    class: className,
    style,
    ...attributes
  }) => {
    return (
      <section
        class={["message-list", className]}
        aria-label="Messages"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <h2>Inbox</h2>
        <ul>
          {messages.map((message) => (
            <li key={message.id}>{message.subject}</li>
          ))}
        </ul>
        <>{messages.length === 0 ? <p>{emptyText}</p> : null}</>
        <h2>Archive</h2>
        <ul>
          {archived.map((message) => (
            <li key={message.id}>{message.subject}</li>
          ))}
        </ul>
        {archived.length === 0 ? <p>No archived messages.</p> : <p>{archived.length} archived</p>}
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
