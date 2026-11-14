import { type JSX, createRoot, createSignal, getOwner, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";

export interface NoticeProps {
  message: string;
}

export default function Notice(props: NoticeProps & { class?: string; style?: JSX.CSSProperties }) {
  const [dismissed, setDismissed] = createSignal(0);

  return (
    <section
      class={props.class ? `inbox ${props.class}` : "inbox"}
      aria-label="Inbox"
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
