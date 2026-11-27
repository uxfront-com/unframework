import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface User {
  name: string;
}

export interface GreetingSlots {
  children?: JSX.Element;
}

export default function Greeting(
  props: { user?: User } & GreetingSlots &
    Omit<ComponentProps<"p">, "user" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "user", "children", "class");

  return (
    <p class={props.class ? `greeting ${props.class}` : "greeting"} {...others}>
      <Show when={props.user} fallback={<i>{props.children ?? "Guest"}</i>}>
        <b>{props.children ?? props.user.name}</b>
      </Show>
    </p>
  );
}
