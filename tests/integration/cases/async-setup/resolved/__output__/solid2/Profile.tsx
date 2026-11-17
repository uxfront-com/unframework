import { loadUser } from "./api";
import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo, createSignal, getObserver, untrack } from "solid-js";

export default function Profile(
  props: { id: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;
          const [visits, setVisits] = createState(user.visits);

          return (
            <p
              class={props.class ? `profile ${props.class}` : "profile"}
              style={props.style}
              {...scopeAttributes(props)}
            >
              {user.name}{" "}
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                Visits: {visits()}
              </button>
            </p>
          );
        }}
      </Show>
    </Loading>
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
