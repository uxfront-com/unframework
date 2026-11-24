import type { ComponentProps, JSX } from "@solidjs/web";
import { For, Match, Show, Switch, createMemo, merge, omit, untrack } from "solid-js";

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

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
