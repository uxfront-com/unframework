import { nextTick } from "./_unframework/nextTick";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export default function SaveDraft(
  props: SaveDraftEvents & Omit<ComponentProps<"section">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["onSaved", "class"]);

  const [status, setStatus] = createSignal("Not saved");
  const [attempts, setAttempts] = createSignal(0);

  async function save() {
    setStatus("Saving");
    setAttempts(attempts() + 1);
    await Promise.resolve();
    setStatus("Checking");
    await nextTick();
    setStatus(`Saved, attempt ${attempts()}`);
    props.onSaved?.(attempts(), status());
  }

  return (
    <section
      class={props.class ? `save-draft ${props.class}` : "save-draft"}
      aria-label="Draft"
      {...others}
    >
      <p role="status">{status()}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
}
