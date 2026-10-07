import { type KeyboardEvent, useRef, useState } from "react";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed?: () => void;
  onSubscribed?: (count: number) => void;
  onChosen?: (action: string, scope: string) => void;
}

export default function QuickActions({
  actions,
  onWelcomed,
  onSubscribed,
  onChosen,
}: QuickActionsProps & QuickActionsEvents) {
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  const [lastKey, setLastKey] = useState("none");
  const lastKeyRef = useRef(lastKey);
  const [scope, setScope] = useState("mine");
  const scopeRef = useRef(scope);
  const [subscriptions, setSubscriptions] = useState(0);
  const subscriptionsRef = useRef(subscriptions);

  function clear(event: KeyboardEvent) {
    event.preventDefault();
    queryRef.current = "";
    setQuery(queryRef.current);
  }

  function track(event: KeyboardEvent): boolean {
    lastKeyRef.current = event.key;
    setLastKey(lastKeyRef.current);
    return event.key === "Enter";
  }

  function keyFor(action: string, event: KeyboardEvent): boolean {
    lastKeyRef.current = `${action}: ${event.key}`;
    setLastKey(lastKeyRef.current);
    return false;
  }

  function choose(action: string, current: string) {
    onChosen?.(action, current);
  }

  const submitOnce = useOnce();

  return (
    <section className="quick-actions" aria-label="Quick actions">
      <label>
        Search
        <input
          name="query"
          onInput={(event) => {
            queryRef.current = (event.currentTarget as HTMLInputElement).value;
            setQuery(queryRef.current);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") clear(event);
          }}
        />
      </label>
      <p>Query: {query}</p>
      <label>
        Note
        <input name="note" onKeyDown={(event) => track(event)} />
      </label>
      <label>
        Scope
        <select
          name="scope"
          onChange={(event) => {
            scopeRef.current = (event.currentTarget as HTMLSelectElement).value;
            setScope(scopeRef.current);
          }}
        >
          <option value="mine">Mine</option>
          <option value="team">Team</option>
        </select>
      </label>
      <ul aria-label="Actions">
        {actions.map((action) => (
          <li key={action}>
            <label>
              {`Shortcut for ${action}`}
              <input name={action} onKeyDown={(event) => keyFor(action, event)} />
            </label>
            <button
              type="button"
              onClick={() => choose(action, scopeRef.current)}
            >{`Run ${action}`}</button>
          </li>
        ))}
      </ul>
      <p>Last key: {lastKey}</p>
      <form
        className="subscribe"
        aria-label="Subscribe"
        onSubmit={(event) => {
          if (submitOnce(event)) {
            event.preventDefault();
            onWelcomed?.();
          }
          event.preventDefault();
          subscriptionsRef.current += 1;
          setSubscriptions(subscriptionsRef.current);
          onSubscribed?.(subscriptionsRef.current);
        }}
      >
        <p>Subscriptions: {subscriptions}</p>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  );
}

/** The guard of a listener that runs once per element, as `{ once: true }` makes it. */
function useOnce(): (event: { currentTarget: EventTarget | null }) => boolean {
  const fired = useRef(new WeakSet<EventTarget>());
  return (event) => {
    const target = event.currentTarget;
    if (!target || fired.current.has(target)) return false;
    fired.current.add(target);
    return true;
  };
}
