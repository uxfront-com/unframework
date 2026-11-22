import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: MessageListProps & MessageListAttributes) {
  return (
    <section
      className={cx("message-list", className)}
      aria-label="Messages"
      style={style}
      {...scopeAttributes(attributes)}
    >
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
