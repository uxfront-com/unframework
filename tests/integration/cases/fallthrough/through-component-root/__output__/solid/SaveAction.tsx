import Pressable from "./Pressable";
import { type ComponentProps, splitProps } from "solid-js";

export default function SaveAction(
  props: { text: string } & Omit<ComponentProps<typeof Pressable>, "text">,
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <Pressable text={props.text} class={props.class ? `save ${props.class}` : "save"} {...others} />
  );
}
