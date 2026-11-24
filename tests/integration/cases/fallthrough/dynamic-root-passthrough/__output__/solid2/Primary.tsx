import Base from "./Base";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function Primary(
  props: { href?: string; text: string } & Omit<ComponentProps<typeof Base>, "href" | "text">,
) {
  const others = omit(props, "href", "text", "class");

  return (
    <Base
      href={props.href}
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      {...others}
    />
  );
}
