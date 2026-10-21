import Card from "./Card";
import Chip from "./Chip";
import { type JSX, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Tag(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const [compact, setCompact] = createSignal(true);

  return (
    <section aria-label="Tag" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Dynamic component={compact() ? Chip : Card} label={props.label} />
      <button type="button" onClick={() => setCompact(!compact())}>
        {compact() ? "Expand" : "Compact"}
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
