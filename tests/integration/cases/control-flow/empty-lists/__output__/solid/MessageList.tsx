import { For, Show, mergeProps } from "solid-js";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export default function MessageList(rawProps: MessageListProps) {
  const props = mergeProps(
    { archived: [], emptyText: "Nothing here yet." } satisfies Partial<MessageListProps>,
    rawProps,
  );
  return (
    <section class="message-list" aria-label="Messages">
      <h2>Inbox</h2>
      <ul>
        <For each={props.messages}>{(message) => <li>{message.subject}</li>}</For>
      </ul>
      <Show when={props.messages.length === 0}>
        <p>{props.emptyText}</p>
      </Show>
      <h2>Archive</h2>
      <ul>
        <For each={props.archived}>{(message) => <li>{message.subject}</li>}</For>
      </ul>
      <Show when={props.archived.length === 0} fallback={<p>{props.archived.length} archived</p>}>
        <p>No archived messages.</p>
      </Show>
    </section>
  );
}
