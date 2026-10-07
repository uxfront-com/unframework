import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface QuickActionsProps {
  actions: string[];
}

export interface QuickActionsEvents {
  onWelcomed$?: QRL<() => void>;
  onSubscribed$?: QRL<(count: number) => void>;
  onChosen$?: QRL<(action: string, scope: string) => void>;
}

export default component$<QuickActionsProps & QuickActionsEvents>(
  ({ actions, onWelcomed$, onSubscribed$, onChosen$ }) => {
    const query = useSignal("");
    const lastKey = useSignal("none");
    const scope = useSignal("mine");
    const subscriptions = useSignal(0);

    const clear = $((_event: KeyboardEvent) => {
      query.value = "";
    });

    const track = $((event: KeyboardEvent): boolean => {
      lastKey.value = event.key;
      return event.key === "Enter";
    });

    const keyFor = $((action: string, event: KeyboardEvent): boolean => {
      lastKey.value = `${action}: ${event.key}`;
      return false;
    });

    const choose = $((action: string, current: string) => {
      onChosen$?.(action, current);
    });

    return (
      <section class="quick-actions" aria-label="Quick actions">
        <label>
          Search
          <input
            name="query"
            onInput$={(_, element) => (query.value = (element as HTMLInputElement).value)}
            onKeyDown$={[
              sync$((event: KeyboardEvent) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                }
              }),
              $(async (event: KeyboardEvent) => {
                if (event.key === "Escape") await clear(event);
              }),
            ]}
          />
        </label>
        <p>Query: {query.value}</p>
        <label>
          Note
          <input name="note" onKeyDown$={(event) => track(event)} />
        </label>
        <label>
          Scope
          <select
            name="scope"
            onChange$={(_, element) => (scope.value = (element as HTMLSelectElement).value)}
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
                <input name={action} onKeyDown$={(event) => keyFor(action, event)} />
              </label>
              <button
                type="button"
                onClick$={() => choose(action, scope.value)}
              >{`Run ${action}`}</button>
            </li>
          ))}
        </ul>
        <p>Last key: {lastKey.value}</p>
        <form
          class="subscribe"
          aria-label="Subscribe"
          preventdefault:submit
          onSubmit$={(_, element) => {
            if (!onceSubmit.has(element)) {
              onceSubmit.add(element);
              onWelcomed$?.();
            }
            {
              subscriptions.value += 1;
              onSubscribed$?.(subscriptions.value);
            }
          }}
        >
          <p>Subscriptions: {subscriptions.value}</p>
          <button type="submit">Subscribe</button>
        </form>
      </section>
    );
  },
);

// The elements each `once` listener ran for: Qwik's listeners have no `once` option.
const onceSubmit = new WeakSet<Element>();
