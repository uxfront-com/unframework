import Base from "./Base";
import { type ComponentProps, splitProps } from "solid-js";

export default function Primary(
  props: { text: string } & Omit<ComponentProps<typeof Base>, "text">,
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <Base
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      {...others}
    />
  );
}
