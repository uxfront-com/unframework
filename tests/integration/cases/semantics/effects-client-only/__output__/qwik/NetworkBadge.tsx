import {
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const online = useSignal<boolean>();
    const label = useSignal("Checking the connection");

    const previousOnline = useSignal(() => online.value);
    useTask$(
      ({ track }) => {
        const value = track(online);
        if (Object.is(value, previousOnline.value)) return;
        previousOnline.value = value;
        label.value = value ? "Online" : "Offline";
      },
      { deferUpdates: false },
    );

    useVisibleTask$(
      () => {
        online.value = navigator.onLine;
      },
      { strategy: "document-ready" },
    );

    return (
      <p
        class={["network-badge", className]}
        role="status"
        data-checked={online.value === undefined ? "no" : "yes"}
        {...scopeAttributes(attributes)}
        style={style}
      >
        {label.value}
      </p>
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
