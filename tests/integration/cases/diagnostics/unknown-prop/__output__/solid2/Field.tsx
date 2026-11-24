import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function Field(
  props: { label: string } & Omit<ComponentProps<"label">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label");

  return (
    <label {...others}>
      {props.label} <input type="text" />
    </label>
  );
}
