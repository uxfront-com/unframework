import Toast from "./Toast";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show } from "solid-js";

export default function Inbox(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [shown, setShown] = createState(true);

  return (
    <section aria-label="Inbox" {...props}>
      <button type="button" onClick={() => setShown(!shown())}>
        {shown() ? "Hide" : "Show"}
      </button>
      <Show when={shown()}>
        <Toast />
      </Show>
    </section>
  );
}
