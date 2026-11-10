import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const size = useSignal<Size>(DEFAULT_SIZE);

    const pick = $((next: Size) => {
      size.value = next;
    });

    return (
      <fieldset class={["size-picker", className]} {...scopeAttributes(attributes)} style={style}>
        <legend>Size</legend>
        <p role="status">Picked: {SIZES[size.value]}</p>
        <ul>
          {SIZE_ORDER.map((each) => (
            <li key={each}>
              <button type="button" aria-pressed={size.value === each} onClick$={() => pick(each)}>
                {SIZES[each]}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
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
