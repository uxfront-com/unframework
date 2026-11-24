import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Field(
  props: { label: string } & Omit<ComponentProps<"input">, "label" | "style" | "ref"> & {
      style?: JSX.CSSProperties;
    } & Pick<ComponentProps<"label">, "ref">,
) {
  const [, rest] = splitProps(props, ["label", "ref"]);

  return (
    <label class="field" {...scopeAttributes(props)} ref={props.ref}>
      {props.label} <input name={props.label.toLowerCase()} {...restAttributes(rest)} />
    </label>
  );
}

/** What the consumer passes, but the scope attributes of the styled parents, which the root keeps. */
function restAttributes(rest: object): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(rest)) {
    if (!name.startsWith("data-uf-")) attributes[name] = value;
  }
  return attributes;
}
