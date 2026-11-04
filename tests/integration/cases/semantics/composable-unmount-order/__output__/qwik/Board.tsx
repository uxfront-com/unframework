import Panel from "./Panel";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const showA = useSignal(true);
    const showB = useSignal(true);
    const entries = useSignal<string[]>([]);

    const record = $((entry: string) => {
      entries.value = [...entries.value, entry];
    });

    return (
      <div class={["board", className]} {...scopeAttributes(attributes)} style={style}>
        <>{showA.value ? <Panel name="a" onClosed$={record} /> : null}</>
        <>{showB.value ? <Panel name="b" onClosed$={record} /> : null}</>
        <button type="button" onClick$={() => (showA.value = false)}>
          Hide a
        </button>
        <button type="button" onClick$={() => (showB.value = false)}>
          Hide b
        </button>
        <output>{entries.value.join(", ")}</output>
      </div>
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
