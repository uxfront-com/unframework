import Disclosure from "./Disclosure";
import { queueHook } from "./_unframework/queueHook";
import {
  type ComponentProps,
  type JSX,
  Show,
  createSignal,
  onCleanup,
  onMount,
  splitProps,
  untrack,
} from "solid-js";

function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      const call = `mounted ${value}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent("directive-trace", { detail: { call, el } }));
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onMount(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.mounted(element, current), "mounted");
  });
  onCleanup(() => {
    const element = target;
    if (element) queueHook(element, () => hooks.unmounted(element), "unmounted");
  });
  return (element) => {
    target = element;
  };
}

export default function Card(
  props: Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  const [note, setNote] = createSignal<{ name: string } | null>({ name: "note" });

  return (
    <section class={props.class ? `card ${props.class}` : "card"} aria-label="Card" {...others}>
      <Disclosure>
        <p data-name="body" ref={vTrace(() => "body")}>
          Body
        </p>
        <Show when={note()}>
          {(note) => (
            <p data-name="note" ref={vTrace(() => note().name)}>
              Note
            </p>
          )}
        </Show>
      </Disclosure>
      <button type="button" onClick={() => setNote({ name: "renamed" })}>
        Rename
      </button>
    </section>
  );
}
