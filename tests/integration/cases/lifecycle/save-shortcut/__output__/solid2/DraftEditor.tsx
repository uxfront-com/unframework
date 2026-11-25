import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onSettled } from "solid-js";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export default function DraftEditor(
  props: DraftEditorEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onSaved", "class");

  const [saves, setSaves] = createState(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    setSaves(saves() + 1);
    props.onSaved?.(saves());
  }

  onSettled(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onSettled(() => () => {
    document.removeEventListener("keydown", onShortcut);
  });

  return (
    <section
      class={props.class ? `draft-editor ${props.class}` : "draft-editor"}
      aria-label="Draft"
      {...others}
    >
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves()}</p>
    </section>
  );
}
