import ConfirmDialog from "./ConfirmDialog";
import {
  type ComponentProps,
  type JSX,
  Show,
  createRoot,
  createSignal,
  getOwner,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";
import { insert } from "solid-js/web";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export default function Files(
  props: FilesProps &
    FilesEvents &
    Omit<ComponentProps<"section">, "file" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["file", "onDelete", "class"]);

  const [open, setOpen] = createSignal(false);

  function confirm() {
    setOpen(false);
    props.onDelete?.(props.file);
  }

  return (
    <section class={props.class ? `files ${props.class}` : "files"} aria-label="Files" {...others}>
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
