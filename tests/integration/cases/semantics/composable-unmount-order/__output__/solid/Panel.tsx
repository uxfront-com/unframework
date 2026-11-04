import { useTeardown } from "./useTeardown";
import type { JSX } from "solid-js";

export interface PanelEvents {
  onClosed?: (entry: string) => void;
}

export default function Panel(
  props: { name: string } & PanelEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const { title } = useTeardown(
    () => props.name,
    (entry) => props.onClosed?.(entry),
  );

  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={title()}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{title()}</h2>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
