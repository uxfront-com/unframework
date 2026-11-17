import { type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, onSettled, untrack } from "solid-js";
import "./Toast.uf.tsx.css";

export interface ToastProps {
  message: string;
}

export default function Toast(props: ToastProps) {
  return (
    <>
      <Teleport to="body">
        <div data-teleported="true" class="toast" role="alert" data-uf-416dbabb="">
          <p data-uf-416dbabb="">{props.message}</p>
        </div>
      </Teleport>
    </>
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
