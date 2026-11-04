import Picker from "./Picker";
import type { JSX } from "solid-js";

interface Fruit {
  name: string;
  count: number;
}

export default function Fruits(
  props: { fruits: Fruit[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Picker
      items={props.fruits}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
      item={({ item }) => (
        <span>
          {item.name} × {item.count}
        </span>
      )}
    />
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
