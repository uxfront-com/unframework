import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Field(
  props: { label: string } & Omit<ComponentProps<"input">, "label" | "class" | "style" | "ref"> & {
      class?: string;
      style?: JSX.CSSProperties;
    } & Pick<ComponentProps<"label">, "ref">,
) {
  const rest = omit(omit(props, "label", "ref"), (name) => String(name).startsWith("data-uf-"));

  return (
    <label class="field" {...scopeAttributes(props)} ref={props.ref}>
      {props.label} <input name={props.label.toLowerCase()} {...rest} />
    </label>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
