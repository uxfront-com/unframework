import { type JSX, createRoot, createSignal, getOwner, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";

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

/** Mounts `children` into the element `to` selects once the component has mounted, and removes them with it. */
function Teleport(props: { to: string; children: JSX.Element }): JSX.Element {
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
