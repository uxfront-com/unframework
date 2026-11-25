import { createState } from "./_unframework/createState";
import { type ComponentProps, type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, omit, onSettled, untrack } from "solid-js";

export interface NoticeProps {
  message: string;
}

export default function Notice(
  props: NoticeProps &
    Omit<ComponentProps<"section">, "message" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "message", "class");

  const [dismissed, setDismissed] = createState(0);

  return (
    <section class={props.class ? `inbox ${props.class}` : "inbox"} aria-label="Inbox" {...others}>
      <p>Dismissed {dismissed()} times</p>
      <Teleport to="body">
        <div data-teleported="true" class="notice">
          <p role="status">
            {props.message} ({dismissed()})
          </p>
          <button type="button" onClick={() => setDismissed(dismissed() + 1)}>
            Dismiss
          </button>
        </div>
      </Teleport>
    </section>
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
