import ConfirmDialog from "./ConfirmDialog";
import { Teleport } from "./_unframework/Teleport";
import { type ComponentProps, type JSX, Show, createSignal, splitProps } from "solid-js";

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
