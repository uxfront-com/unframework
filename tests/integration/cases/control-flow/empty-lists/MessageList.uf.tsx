export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export default function MessageList({
  messages,
  archived = [],
  emptyText = "Nothing here yet.",
}: MessageListProps) {
  return (
    <section class="message-list" aria-label="Messages">
      <h2>Inbox</h2>
      <ul>
        {messages.map((message) => (
          <li key={message.id}>{message.subject}</li>
        ))}
      </ul>
      {messages.length === 0 && <p>{emptyText}</p>}
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
