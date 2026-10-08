import { For, createSignal } from "solid-js";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed?: () => void;
  onSubscribed?: (count: number) => void;
  onChosen?: (action: string, scope: string) => void;
}

export default function QuickActions(props: QuickActionsProps & QuickActionsEvents) {
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
    <section class="quick-actions" aria-label="Quick actions">
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
        <For each={props.actions}>
          {(action) => (
            <li>
              <label>
                {`Shortcut for ${action}`}
                <input name={action} onKeyDown={(event) => keyFor(action, event)} />
              </label>
              <button
                type="button"
                onClick={() => choose(action, scope())}
              >{`Run ${action}`}</button>
            </li>
          )}
        </For>
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
