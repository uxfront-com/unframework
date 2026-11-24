import ConfirmDialog from "./ConfirmDialog";
import { teleport } from "./_unframework/teleport";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface FilesProps {
  file: string;
}

export interface FilesEvents {
  onDelete$?: QRL<(file: string) => void>;
}

export default component$<
  FilesProps &
    FilesEvents &
    Omit<PropsOf<"section">, "file" | "onDelete$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ file, onDelete$, class: className, style, ...attributes }) => {
  const open = useSignal(false);

  const confirm = $(() => {
    open.value = false;
    onDelete$?.(file);
  });

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["files", className]} aria-label="Files" style={style} {...attributes}>
      <p>{file}</p>
      <button type="button" onClick$={() => (open.value = true)}>
        Delete {file}
      </button>
      {open.value
        ? mounted.value && (
            <>
              {""}
              <div ref={teleport("body")} data-teleported="true" class="backdrop">
                <ConfirmDialog
                  title={`Delete ${file}?`}
                  onConfirm$={confirm}
                  onClose$={() => (open.value = false)}
                />
              </div>
            </>
          )
        : null}
    </section>
  );
});
