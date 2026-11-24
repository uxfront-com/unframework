import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface MessageListEvents {
  onRendered$?: QRL<(count: number) => void>;
}

export default component$<
  MessageListEvents &
    Omit<PropsOf<"section">, "onRendered$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ onRendered$, class: className, style, ...attributes }) => {
  const messages = useSignal(["Welcome to the team"]);
  const list = useSignal<HTMLUListElement>();

  const previousMessages = useSignal(() => messages.value);
  useVisibleTask$(
    ({ track }) => {
      const value = track(messages);
      if (Object.is(value, previousMessages.value)) return;
      previousMessages.value = value;
      onRendered$?.(list.value?.childElementCount ?? 0);
    },
    { strategy: "document-ready" },
  );

  const add = $(() => {
    messages.value = [...messages.value, `Message ${messages.value.length + 1}`];
  });

  return (
    <section
      class={["message-list", className]}
      aria-label="Messages"
      style={style}
      {...attributes}
    >
      <ul ref={list}>
        {messages.value.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      <button type="button" onClick$={add}>
        Add a message
      </button>
    </section>
  );
});
