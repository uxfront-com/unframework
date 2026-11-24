import Base from "./Base";
import { type ComponentProps, splitProps } from "solid-js";

export interface PrimaryEvents {
  onPress?: () => void;
}

export default function Primary(
  props: { href?: string; disabled?: boolean; text: string } & PrimaryEvents &
    Omit<ComponentProps<typeof Base>, "href" | "disabled" | "text" | "onPress">,
) {
  const [, others] = splitProps(props, ["href", "disabled", "text", "onPress", "class"]);

  return (
    <Base
      href={props.href}
      disabled={props.disabled}
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      onPress={() => props.onPress?.()}
      {...others}
    />
  );
}
