import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver } from "solid-js";

interface User {
  name: string;
}

export interface NarrowedStateProps {
  member?: User;
}

export interface NarrowedStateEvents {
  onPicked?: (name: string) => void;
}

export default function NarrowedState(
  props: NarrowedStateProps & NarrowedStateEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [user, setUser] = createState<User | null>(null);
  const [draft, setDraft] = createState<string | null>(null);

  function pick(name: string) {
    setUser({ name });
    props.onPicked?.(name);
  }

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Show
        when={((user) => (user !== null ? { user } : undefined))(user())}
        fallback={<p>Nobody</p>}
      >
        {(narrowed) => <p>{narrowed().user.name}</p>}
      </Show>
      <Show when={((draft) => (draft !== null ? { draft } : undefined))(draft())}>
        {(narrowed) => <p>{narrowed().draft.toUpperCase()}</p>}
      </Show>
      <Show when={props.member}>
        {(member) => (
          <button type="button" onClick={() => pick(member().name)}>
            {member().name}
          </button>
        )}
      </Show>
      <button type="button" onClick={() => setDraft("x")}>
        Draft
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
