import ConfirmDialog from "./ConfirmDialog";
import { createState } from "./_unframework/createState";
import { type ComponentProps, type JSX, Portal } from "@solidjs/web";
import { Show, createSignal, flush, omit, onSettled, untrack } from "solid-js";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete?: (file: string) => void;
}

export default function Files(
  props: FilesProps &
    FilesEvents &
    Omit<ComponentProps<"section">, "file" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "file", "onDelete", "class");

  const [open, setOpen] = createState(false);

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
