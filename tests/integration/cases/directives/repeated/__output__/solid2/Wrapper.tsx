import Rows from "./Rows";
import type { JSX } from "@solidjs/web";

export interface WrapperSlots {
  row?: JSX.Element;
}

export default function Wrapper(
  props: WrapperSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `wrapper ${props.class}` : "wrapper"}
      aria-label="Rows"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Rows row={props.row} />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
