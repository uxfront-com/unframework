import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useId,
  useSignal,
} from "@qwik.dev/core";

export interface SizePickerProps {
  legend: string;
  sizes: string[];
}

export default component$<
  SizePickerProps &
    Omit<PropsOf<"fieldset">, "legend" | "sizes" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ legend, sizes, class: className, style, ...attributes }) => {
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
      style={style}
      {...attributes}
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
});
