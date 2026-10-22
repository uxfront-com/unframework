import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface MessageListEvents {
  onRendered$?: QRL<(count: number) => void>;
}

export default component$<MessageListEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onRendered$, class: className, style, ...attributes }) => {
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
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
