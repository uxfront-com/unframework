import Base from "./Base";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function Primary(
  props: { text: string } & Omit<ComponentProps<typeof Base>, "text">,
) {
  const others = omit(props, "text", "class");

  return (
    <Base
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      {...others}
    />
  );
}
