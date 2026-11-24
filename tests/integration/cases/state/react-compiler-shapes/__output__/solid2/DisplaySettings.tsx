import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface Settings {
  theme: string;
  size: number;
}

interface SaveReply {
  id?: number;
  error?: string;
}

export interface DisplaySettingsEvents {
  onApplied?: (theme: string, size: number) => void;
  onSaved?: (id: number) => void;
}

export default function DisplaySettings(
  props: DisplaySettingsEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onApplied", "onSaved", "class");

  const [settings, setSettings] = createState<Settings>({ theme: "light", size: 14 });
  const [maxSize, setMaxSize] = createState(20);
  const [saving, setSaving] = createState(false);
  const [label, setLabel] = createState("Never saved");
  const [failure, setFailure] = createState("");
  let finish: ((reply: SaveReply) => void) | undefined;

  function apply(patch: Partial<Settings>) {
    const { theme = settings().theme, size = settings().size } = patch;
    setSettings({ theme, size });
    props.onApplied?.(theme, size);
  }

  function grow() {
    const clamp = (value: number, max = maxSize()) => Math.min(value, max);
    apply({ size: clamp(settings().size + 4) });
  }

  async function save() {
    setSaving(true);
    setFailure("");
    try {
      const reply = await new Promise<SaveReply>((resolve) => {
        finish = resolve;
      });
      if (reply.error) throw new Error(reply.error);
      const id = reply.id ?? 0;
      setLabel(id === 0 ? "Saved as a draft" : `Saved as #${id}`);
      props.onSaved?.(id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Saving failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      class={props.class ? `display-settings ${props.class}` : "display-settings"}
      aria-label="Display"
      {...others}
    >
      <p role="status">
        Theme {settings().theme}, size {settings().size}
      </p>
      <button type="button" onClick={() => apply({ theme: "dark" })}>
        Dark
      </button>
      <button type="button" onClick={grow}>
        Larger
      </button>
      <button type="button" onClick={() => setMaxSize(30)}>
        Allow up to 30
      </button>
      <button type="button" onClick={save}>
        Save
      </button>
      <p>{saving() ? "Saving" : failure() === "" ? label() : `Failed: ${failure()}`}</p>
      <div role="group" aria-label="Server">
        <button type="button" onClick={() => finish?.({ id: 7 })}>
          Reply with an id
        </button>
        <button type="button" onClick={() => finish?.({})}>
          Reply as a draft
        </button>
        <button type="button" onClick={() => finish?.({ error: "Disk full" })}>
          Reply with an error
        </button>
      </div>
    </section>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
