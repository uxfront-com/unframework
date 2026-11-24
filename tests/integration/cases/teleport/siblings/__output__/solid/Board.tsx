import Panel from "./Panel";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

export default function Board(
  props: Omit<ComponentProps<"main">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [shown, setShown] = createSignal(true);

  return (
    <main class={props.class ? `board ${props.class}` : "board"} {...others}>
      <button type="button" onClick={() => setShown(false)}>
        Remove panel
      </button>
      <Show when={shown()}>
        <Panel />
      </Show>
    </main>
  );
}
