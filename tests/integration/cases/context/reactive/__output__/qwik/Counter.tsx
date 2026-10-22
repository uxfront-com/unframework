import Display from "./Display";
import {
  type CSSProperties,
  type ClassList,
  type Signal,
  component$,
  createContextId,
  useContextProvider,
  useSignal,
} from "@qwik.dev/core";

export const CountKey = createContextId<Signal<number>>("uf.count");

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const count = useSignal(1);

    useContextProvider(CountKey, count);

    return (
      <section
        aria-label="Counter"
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
        <Display />
        <button type="button" onClick$={() => (count.value += 1)}>
          Add one
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
