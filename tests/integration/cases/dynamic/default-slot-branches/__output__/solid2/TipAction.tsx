import { type ComponentProps, Dynamic, type JSX, Portal } from "@solidjs/web";
import { Show, children, createSignal, flush, omit, onSettled, untrack } from "solid-js";

export interface TipActionSlots {
  children?: JSX.Element;
}

export default function TipAction(
  props: { href?: string; label: string } & TipActionSlots &
    Omit<
      Omit<
        ComponentProps<"a"> & ComponentProps<"button">,
        keyof JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>
      > &
        JSX.ElementAttributes<HTMLElementTagNameMap["a" | "button"]>,
      "href" | "label" | "children" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "href", "label", "children", "ref");

  const content = children(() => props.children);
  return (
    <Dynamic
      component={props.href ? "a" : "button"}
      href={(props.href ? "a" : "button") === "a" ? props.href : undefined}
      ref={(element: HTMLElementTagNameMap["a" | "button"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      {props.label}
      <Teleport to="body">
        <p data-teleported="true" class="tip" role="note">
          {content() ?? props.label}
        </p>
      </Teleport>
    </Dynamic>
  );
}

/** The teleports rendered and not yet mounted, in the order they rendered. */
const TeleportQueue: (() => void)[] = [];

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
  const [target, setTarget] = createSignal<Element | null>(null);
  // Where it mounts is read once, as it mounts.
  const to = untrack(() => props.to);
  TeleportQueue.push(() => setTarget(document.querySelector(to)));
  onSettled(() => {
    if (TeleportQueue.length) {
      queueMicrotask(() => {
        for (const mount of TeleportQueue.splice(0)) {
          mount();
          flush();
        }
      });
    }
  });
  return (
    <Show when={target()}>{(mount) => <Portal mount={mount()}>{props.children}</Portal>}</Show>
  );
}
