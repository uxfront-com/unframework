import Counter from "./Counter";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const counter = useSignal<{ increment(): void; reset(): void }>();

    return (
      <div class={["controls", className]} {...scopeAttributes(attributes)} style={style}>
        <Counter ref={counter} start={10} />
        <button type="button" onClick$={() => counter.value?.increment()}>
          More
        </button>
        <button type="button" onClick$={() => counter.value?.reset()}>
          Reset
        </button>
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
