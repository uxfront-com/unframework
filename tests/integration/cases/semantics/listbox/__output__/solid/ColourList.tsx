import { type JSX, createSignal } from "solid-js";

export default function ColourList(props: { class?: string; style?: JSX.CSSProperties }) {
  const [colour, setColour] = createSignal("none");

  return (
    <section
      aria-label="Colours"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
