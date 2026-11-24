import Panel from "./Panel";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Board(
  props: Omit<ComponentProps<"main">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [shown, setShown] = createState(true);

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
