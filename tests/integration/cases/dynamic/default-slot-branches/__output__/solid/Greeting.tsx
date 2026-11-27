import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

export interface User {
  name: string;
}

export interface GreetingSlots {
  children?: JSX.Element;
}

export default function Greeting(
  props: { user?: User } & GreetingSlots &
    Omit<ComponentProps<"p">, "user" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["user", "children", "class"]);

  return (
    <p class={props.class ? `greeting ${props.class}` : "greeting"} {...others}>
      <Show when={props.user} fallback={<i>{props.children ?? "Guest"}</i>}>
        {(user) => <b>{props.children ?? user().name}</b>}
      </Show>
    </p>
  );
}
