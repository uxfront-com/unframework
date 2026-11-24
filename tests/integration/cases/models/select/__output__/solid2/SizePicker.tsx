import { createState } from "./_unframework/createState";
import { selectOptions } from "./_unframework/selectOptions";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function SizePicker(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [size, setSize] = createState("m");

  return (
    <section aria-label="Size" {...props}>
      <label>
        Size{" "}
        <select onChange={(event) => setSize(event.currentTarget.value)} ref={selectOptions(size)}>
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
