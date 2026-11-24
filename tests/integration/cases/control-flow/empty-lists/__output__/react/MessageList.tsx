import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export type MessageListAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "messages" | "archived" | "emptyText" | "children"
>;

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
      {...attributes}
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
