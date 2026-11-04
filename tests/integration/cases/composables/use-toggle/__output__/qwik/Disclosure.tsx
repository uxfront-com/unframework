import { useToggle } from "./useToggle";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const { on, toggle, close } = useToggle(false);

    return (
      <section
        class={["disclosure", className]}
        aria-label="Shipping"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <button type="button" aria-expanded={on.value} onClick$={() => toggle()}>
          Shipping details
        </button>
        {on.value ? (
          <div class="panel">
            <p>Orders ship within two days.</p>
            <button type="button" onClick$={() => close()}>
              Close
            </button>
          </div>
        ) : null}
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
