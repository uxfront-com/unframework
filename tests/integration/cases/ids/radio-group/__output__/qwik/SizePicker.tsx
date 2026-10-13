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
  ({ legend, sizes, class: className, style }) => {
    const group = "uf-id-" + useId();
    const hintId = "uf-id-" + useId();
    const picked = useSignal("");

    const choose = $((size: string) => {
      picked.value = size;
    });

    return (
      <fieldset class={["size-picker", className]} aria-describedby={hintId} style={style}>
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
