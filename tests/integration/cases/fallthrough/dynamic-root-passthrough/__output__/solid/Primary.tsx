import Base from "./Base";
import { type ComponentProps, splitProps } from "solid-js";

export default function Primary(
  props: { href?: string; text: string } & Omit<ComponentProps<typeof Base>, "href" | "text">,
) {
  const [, others] = splitProps(props, ["href", "text", "class"]);

  return (
    <Base
      href={props.href}
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      {...others}
    />
  );
}
