import { selectOptions } from "./_unframework/selectOptions";
import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function SizePicker(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [size, setSize] = createSignal("m");

  return (
    <section aria-label="Size" {...props}>
      <label>
        Size{" "}
        <select
          onChange={(event) => setSize(event.currentTarget.value)}
          ref={(select) => selectOptions(select, size)}
        >
          <option value="s" selected={size() === "s"}>
            Small
          </option>
          <option value="m" selected={size() === "m"}>
            Medium
          </option>
          <option value="l" selected={size() === "l"}>
            Large
          </option>
        </select>
      </label>
      <output>Chosen: {size()}</output>
      <button type="button" onClick={() => setSize("l")}>
        Largest
      </button>
    </section>
  );
}
