import type { JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, untrack } from "solid-js";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed?: () => void;
  onSubscribed?: (count: number) => void;
  onChosen?: (action: string, scope: string) => void;
}

export default function QuickActions(
  props: QuickActionsProps & QuickActionsEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [query, setQuery] = createState("");
  const [lastKey, setLastKey] = createState("none");
  const [scope, setScope] = createState("mine");
  const [subscriptions, setSubscriptions] = createState(0);

  function clear(event: KeyboardEvent) {
    event.preventDefault();
    setQuery("");
  }

  function track(event: KeyboardEvent): boolean {
    setLastKey(event.key);
    return event.key === "Enter";
  }

  function keyFor(action: string, event: KeyboardEvent): boolean {
    setLastKey(`${action}: ${event.key}`);
    return false;
  }

  function choose(action: string, current: string) {
    props.onChosen?.(action, current);
  }

  return (
    <section
      class={props.class ? `quick-actions ${props.class}` : "quick-actions"}
      aria-label="Quick actions"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label>
        Search
        <input
          name="query"
          onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") clear(event);
          }}
        />
      </label>
      <p>Query: {query()}</p>
      <label>
        Note
        <input name="note" onKeyDown={(event) => track(event)} />
      </label>
      <label>
        Scope
        <select
          name="scope"
          onChange={(event) => setScope((event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="mine">Mine</option>
          <option value="team">Team</option>
        </select>
      </label>
      <ul aria-label="Actions">
        <KeyedFor each={props.actions} by={(action) => action}>
          {(action) => (
            <li>
              <label>
                {`Shortcut for ${action.value}`}
                <input name={action.value} onKeyDown={(event) => keyFor(action.value, event)} />
              </label>
              <button
                type="button"
                onClick={() => choose(action.value, scope())}
              >{`Run ${action.value}`}</button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <p>Last key: {lastKey()}</p>
      <form
        class="subscribe"
        aria-label="Subscribe"
        ref={(element) => {
          element.addEventListener(
            "submit",
            (event) => {
              event.preventDefault();
              props.onWelcomed?.();
            },
            { once: true },
          );
          element.addEventListener("submit", (event) => {
            event.preventDefault();
            setSubscriptions(subscriptions() + 1);
            props.onSubscribed?.(subscriptions());
          });
        }}
      >
        <p>Subscriptions: {subscriptions()}</p>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
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
