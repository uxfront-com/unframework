import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Match, Show, Switch, merge, omit } from "solid-js";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export default function MessageList(
  rawProps: MessageListProps &
    Omit<ComponentProps<"section">, "messages" | "archived" | "emptyText" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const defaults: Required<Pick<MessageListProps, "archived" | "emptyText">> = {
    archived: [],
    emptyText: "Nothing here yet.",
  };
  const props = merge(rawProps, {
    get archived() {
      return rawProps.archived === undefined ? defaults.archived : rawProps.archived;
    },
    get emptyText() {
      return rawProps.emptyText === undefined ? defaults.emptyText : rawProps.emptyText;
    },
  });
  const others = omit(props, "messages", "archived", "emptyText", "class");

  return (
    <section
      class={props.class ? `message-list ${props.class}` : "message-list"}
      aria-label="Messages"
      {...others}
    >
      <h2>Inbox</h2>
      <ul>
        <KeyedFor each={props.messages} by={(message) => message.id}>
          {(message) => <li>{message.value.subject}</li>}
        </KeyedFor>
      </ul>
      <Show when={props.messages.length === 0}>
        <p>{props.emptyText}</p>
      </Show>
      <h2>Archive</h2>
      <ul>
        <KeyedFor each={props.archived} by={(message) => message.id}>
          {(message) => <li>{message.value.subject}</li>}
        </KeyedFor>
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
