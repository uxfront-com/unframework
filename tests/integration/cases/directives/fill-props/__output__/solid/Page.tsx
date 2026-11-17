import Picker from "./Picker";
import { vTrace } from "./vTrace";
import type { JSX } from "solid-js";

export default function Page(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      class={props.class ? `page ${props.class}` : "page"}
      aria-label="Page"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Picker
        option={({ option }) => (
          <span data-name={`option-${option.id}`} ref={vTrace(() => option.label)}>
            {option.label}
          </span>
        )}
      />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
