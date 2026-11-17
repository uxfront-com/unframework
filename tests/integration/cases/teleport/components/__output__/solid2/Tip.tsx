import { type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, onSettled, untrack } from "solid-js";

export interface TipProps {
  label: string;
}

export default function Tip(props: TipProps) {
  return (
    <>
      <Teleport to="body">
        <p data-teleported="true" class="tip" role="note">
          {props.label} tip
        </p>
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
