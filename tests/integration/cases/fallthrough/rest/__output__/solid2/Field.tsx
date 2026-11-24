import { scopeAttributes } from "./_unframework/scopeAttributes";
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
