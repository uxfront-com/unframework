import Pressable from "./Pressable";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

export default function SaveAction(
  props: { text: string } & Omit<ComponentProps<typeof Pressable>, "text">,
) {
  const others = omit(props, "text", "class");

  return (
    <Pressable text={props.text} class={props.class ? `save ${props.class}` : "save"} {...others} />
  );
}
