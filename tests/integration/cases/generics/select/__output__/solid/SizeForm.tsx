import Select from "./Select";
import { type JSX, createSignal } from "solid-js";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm(props: { class?: string; style?: JSX.CSSProperties }) {
  const [size, setSize] = createSignal<Size>("m");

  return (
    <section aria-label="Size" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Select label="Size" options={sizes} value={size()} onValueChange={setSize} />
      <output>Chosen: {size()}</output>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
