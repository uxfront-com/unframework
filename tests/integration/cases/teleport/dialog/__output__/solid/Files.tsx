import ConfirmDialog from "./ConfirmDialog";
import { type JSX, Show, createRoot, createSignal, getOwner, onCleanup, onMount } from "solid-js";
import { insert } from "solid-js/web";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export default function Files(
  props: FilesProps & FilesEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [open, setOpen] = createSignal(false);

  function confirm() {
    setOpen(false);
    props.onDelete?.(props.file);
  }

  return (
    <section
      class={props.class ? `files ${props.class}` : "files"}
      aria-label="Files"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>{props.file}</p>
      <button type="button" onClick={() => setOpen(true)}>
        Delete {props.file}
      </button>
      <Show when={open()}>
        <Teleport to="body">
          <div data-teleported="true" class="backdrop">
            <ConfirmDialog
              title={`Delete ${props.file}?`}
              onConfirm={confirm}
              onClose={() => setOpen(false)}
            />
          </div>
        </Teleport>
      </Show>
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
