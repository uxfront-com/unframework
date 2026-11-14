import { type JSX, createRoot, createSignal, getOwner, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";
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
