import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed?: () => void;
  onSubscribed?: (count: number) => void;
  onChosen?: (action: string, scope: string) => void;
}

export default function QuickActions(
  props: QuickActionsProps &
    QuickActionsEvents &
    Omit<ComponentProps<"section">, "actions" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, [
    "actions",
    "onWelcomed",
    "onSubscribed",
    "onChosen",
    "class",
  ]);

  const [query, setQuery] = createSignal("");
  const [lastKey, setLastKey] = createSignal("none");
  const [scope, setScope] = createSignal("mine");
  const [subscriptions, setSubscriptions] = createSignal(0);

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
      {...others}
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
