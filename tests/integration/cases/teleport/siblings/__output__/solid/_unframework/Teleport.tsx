import { type JSX, createRoot, createSignal, getOwner, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
export function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
  const owner = getOwner();
  onMount(() => {
    const target = document.querySelector(props.to);
    if (!target) return;
    const [removed, remove] = createSignal(false);
    createRoot(
      (dispose) => insert(target, () => (removed() ? dispose() : props.children), null),
      owner,
    );
    onCleanup(() => remove(true));
  });
  return null;
}
