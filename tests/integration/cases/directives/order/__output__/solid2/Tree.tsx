import Note from "./Note";
import { createState } from "./_unframework/createState";
import { queueHook } from "./_unframework/queueHook";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit, onCleanup, onSettled, untrack } from "solid-js";

const TRACE = "directive-trace";

function vTrace(getValue: () => string): (element: HTMLElement) => void {
  const hooks = {
    mounted(el: HTMLElement, value: string) {
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call: `mounted ${value}`, el } }));
    },
    unmounted(el: HTMLElement) {
      const call = `unmounted ${el.getAttribute("data-name")}`;
      document.dispatchEvent(new CustomEvent(TRACE, { detail: { call, el } }));
    },
  };
  let target: HTMLElement | undefined;
  const current = untrack(getValue);
  onSettled(() => {
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

export default function Tree(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [shown, setShown] = createState(true);

  return (
    <section
      class={props.class ? `tree ${props.class}` : "tree"}
      aria-label="Tree"
      data-name="outer"
      ref={vTrace(() => "outer")}
      {...others}
    >
      <p data-name="first" ref={vTrace(() => "first")}>
        First
      </p>
      <Note />
      <Show
        when={shown()}
        fallback={
          <p data-name="placeholder" ref={vTrace(() => "placeholder")}>
            Placeholder
          </p>
        }
      >
        <div class="branch" data-name="branch" ref={vTrace(() => "branch")}>
          <span data-name="leaf" ref={vTrace(() => "leaf")}>
            Leaf
          </span>
        </div>
      </Show>
      <p data-name="last" ref={vTrace(() => "last")}>
        Last
      </p>
      <button type="button" onClick={() => setShown(!shown())}>
        Toggle
      </button>
    </section>
  );
}
