import { type ComponentProps, type JSX, createSignal } from "solid-js";

export default function ColourList(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [colour, setColour] = createSignal("none");

  return (
    <section aria-label="Colours" {...props}>
      <select
        size="3"
        aria-label="Colour"
        onChange={(event) => setColour((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {colour()}</output>
    </section>
  );
}
