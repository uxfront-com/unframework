import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export interface ChoiceSlots {
  body?: JSX.Element;
}

export default function Choice(
  props: ChoiceSlots &
    Omit<ComponentProps<"div">, "body" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["body", "class"]);

  const [first, setFirst] = createSignal(true);

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
