import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export default component$<
  MessageListProps &
    Omit<PropsOf<"section">, "messages" | "archived" | "emptyText" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(
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
        style={style}
        {...attributes}
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
