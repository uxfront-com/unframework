import Panel from "./Panel";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const shown = useSignal(true);

    return (
      <main class={["board", className]} {...scopeAttributes(attributes)} style={style}>
        <button type="button" onClick$={() => (shown.value = false)}>
          Remove panel
        </button>
        {shown.value ? <Panel /> : null}
      </main>
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
