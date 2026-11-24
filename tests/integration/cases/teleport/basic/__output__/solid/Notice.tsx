import {
  type ComponentProps,
  type JSX,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { insert } from "solid-js/web";

export interface NoticeProps {
  message: string;
}

export default function Notice(
  props: NoticeProps &
    Omit<ComponentProps<"section">, "message" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["message", "class"]);

  const [dismissed, setDismissed] = createSignal(0);

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
