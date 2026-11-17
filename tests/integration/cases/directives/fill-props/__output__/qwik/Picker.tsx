import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface PickerSlots {
  option$?: QRL<(props: { option: { id: string; label: string } }) => JSXOutput>;
}

export default component$<PickerSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ option$, class: className, style, ...attributes }) => {
    const options = useSignal([
      { id: "x", label: "Xray" },
      { id: "y", label: "Yankee" },
    ]);

    return (
      <div class={["picker", className]} {...scopeAttributes(attributes)} style={style}>
        <ul aria-label="Options">
          {options.value.map((option) => (
            <li key={option.id}>{option$?.({ option })}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick$={() =>
            (options.value = options.value.map((option) =>
              option.id === "x" ? { id: "x", label: "Xenon" } : option,
            ))
          }
        >
          Rename option
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
