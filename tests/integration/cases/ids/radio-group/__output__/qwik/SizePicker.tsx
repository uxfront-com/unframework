import {
  $,
  type CSSProperties,
  type ClassList,
  component$,
  useId,
  useSignal,
} from "@qwik.dev/core";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default component$<SizePickerProps & { class?: ClassList; style?: CSSProperties }>(
  ({ legend, sizes, class: className, style, ...attributes }) => {
    const group = "uf-id-" + useId();
    const hintId = "uf-id-" + useId();
    const picked = useSignal("");

    const choose = $((size: string) => {
      picked.value = size;
    });

    return (
      <fieldset
        class={["size-picker", className]}
        aria-describedby={hintId}
        {...scopeAttributes(attributes)}
        style={style}
      >
        <legend>{legend}</legend>
        <p id={hintId}>Pick one size.</p>
        {sizes.map((size, index) => (
          <div key={size} class="size">
            <input
              type="radio"
              id={`${group}-${index}`}
              name={group}
              value={size}
              onChange$={() => choose(size)}
            />
            <label for={`${group}-${index}`}>{size}</label>
          </div>
        ))}
        <output>{picked.value || "none"}</output>
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
