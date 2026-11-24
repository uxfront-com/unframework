import Toast from "./Toast";
import { type ComponentProps, type JSX, Show, createSignal } from "solid-js";

export default function Inbox(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [shown, setShown] = createSignal(true);

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
