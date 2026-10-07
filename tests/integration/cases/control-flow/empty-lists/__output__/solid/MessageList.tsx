import { For, Match, Show, Switch, mergeProps } from "solid-js";

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
  const defaults: Required<Pick<MessageListProps, "archived" | "emptyText">> = {
    archived: [],
    emptyText: "Nothing here yet.",
  };
  const props = mergeProps(defaults, rawProps);
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
      <Switch>
        <Match when={props.archived.length === 0}>
          <p>No archived messages.</p>
        </Match>
        <Match when={props.archived.length === 0 ? undefined : { length: props.archived.length }}>
          {(narrowed) => <p>{narrowed().length} archived</p>}
        </Match>
      </Switch>
    </section>
  );
}
