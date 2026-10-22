import {
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  noSerialize,
  useComputed$,
  useConstant,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface ChannelPickerEvents {
  onJoin$?: QRL<(channel: string) => void>;
  onLeave$?: QRL<(channel: string) => void>;
}

export default component$<ChannelPickerEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onJoin$, onLeave$, class: className, style, ...attributes }) => {
    const channel = useSignal("general");

    const nameSource = useComputed$(() => channel.value.toLowerCase());
    const previousName = useSignal<{ value: typeof nameSource.value }>();
    const nameCleanups = useConstant(() => noSerialize<(() => void)[]>([]));
    useTask$(
      ({ track }) => {
        const name = track(nameSource);
        const last = previousName.value;
        if (last && Object.is(name, last.value)) return;
        previousName.value = { value: name };
        for (const callback of nameCleanups?.splice(0) ?? []) callback();
        const onCleanup = (callback: () => void) => void nameCleanups?.push(callback);
        onJoin$?.(name);
        onCleanup(() => {
          onLeave$?.(name);
        });
      },
      { deferUpdates: false },
    );
    useVisibleTask$(
      ({ cleanup }) => {
        cleanup(() => {
          for (const callback of nameCleanups?.splice(0) ?? []) callback();
        });
      },
      { strategy: "document-ready" },
    );

    return (
      <section
        class={["channel-picker", className]}
        aria-label="Channels"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">Channel: #{channel.value}</p>
        <button type="button" onClick$={() => (channel.value = "random")}>
          Join #random
        </button>
        <button type="button" onClick$={() => (channel.value = "General")}>
          Join #General
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
