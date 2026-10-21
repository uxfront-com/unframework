import { CountKey } from "./Counter";
import { type JSX, createSignal, useContext } from "solid-js";

export default function Display(props: { class?: string; style?: JSX.CSSProperties }) {
  const [none] = createSignal(0);
  const count = useContext(CountKey) ?? {
    get value() {
      return none();
    },
  };

  return (
    <output class={props.class} style={props.style} {...scopeAttributes(props)}>
      Count: {count.value}
    </output>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
