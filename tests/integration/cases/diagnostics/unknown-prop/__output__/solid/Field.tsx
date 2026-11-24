import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Field(
  props: { label: string } & Omit<ComponentProps<"label">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label"]);

  return (
    <label {...others}>
      {props.label} <input type="text" />
    </label>
  );
}
