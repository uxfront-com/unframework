import type { CSSProperties } from "react";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export interface MessageListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function MessageList({
  messages,
  archived = [],
  emptyText = "Nothing here yet.",
  className,
  style,
}: MessageListProps & MessageListAttributes) {
  return (
    <section className={cx("message-list", className)} aria-label="Messages" style={style}>
      <h2>Inbox</h2>
      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.subject}</li>
        ))}
      </ul>
      {messages.length === 0 ? <p>{emptyText}</p> : null}
      <h2>Archive</h2>
      <ul>
        {archived.map((message) => (
          <li key={message.id}>{message.subject}</li>
        ))}
      </ul>
      {archived.length === 0 ? <p>No archived messages.</p> : <p>{archived.length} archived</p>}
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
