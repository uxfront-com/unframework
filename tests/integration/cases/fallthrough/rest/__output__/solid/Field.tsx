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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** What the consumer passes, but the scope attributes of the styled parents, which the root keeps. */
function restAttributes(rest: object): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(rest)) {
    if (!name.startsWith("data-uf-")) attributes[name] = value;
  }
  return attributes;
}
