import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface ChoiceSlots {
  body?: JSX.Element;
}

export default function Choice(
  props: ChoiceSlots &
    Omit<ComponentProps<"div">, "body" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "body", "class");

  const [first, setFirst] = createState(true);

  return (
    <div class={props.class ? `choice ${props.class}` : "choice"} {...others}>
      <Show when={first()} fallback={<i>{props.body}</i>}>
        <b>{props.body}</b>
      </Show>
      <button type="button" onClick={() => setFirst(!first())}>
        Switch
      </button>
    </div>
  );
}
