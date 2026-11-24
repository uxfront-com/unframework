import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

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
  props: NarrowedStateProps &
    NarrowedStateEvents &
    Omit<ComponentProps<"div">, "member" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "member", "onPicked");

  const [user, setUser] = createState<User | null>(null);
  const [draft, setDraft] = createState<string | null>(null);

  function pick(name: string) {
    setUser({ name });
    props.onPicked?.(name);
  }

  return (
    <div {...others}>
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
    if (getObserver()) {
      tracked();
    }
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) {
      return;
    }
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
