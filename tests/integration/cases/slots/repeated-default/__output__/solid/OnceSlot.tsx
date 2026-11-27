import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface OnceSlotSlots {
  text?: (props: { label: string }) => JSX.Element;
}

export default function OnceSlot(
  props: { label: string } & OnceSlotSlots &
    Omit<ComponentProps<"span">, "label" | "text" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "text", "class"]);

  return (
    <span class={props.class ? `once-slot ${props.class}` : "once-slot"} {...others}>
      {props.text?.({ label: props.label })}
    </span>
  );
}
