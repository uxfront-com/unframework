import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export default function Member(
  props: { id: string } & Omit<ComponentProps<"article">, "id" | "ref" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
      ref?: (api: { reset: () => void }) => void;
    },
) {
  const others = omit(props, "id", "ref", "class");

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

          function reset() {
            setVisits(0);
          }

          untrack(() => props.ref?.({ reset }));

          return (
            <article class={props.class ? `member ${props.class}` : "member"} {...others}>
              <h3>{user.name}</h3>
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                {user.name} visits: {visits()}
              </button>
            </article>
          );
        }}
      </Show>
    </Loading>
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
