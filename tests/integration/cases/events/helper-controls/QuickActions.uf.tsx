import { defineEmits, ref } from "unframework";

export interface QuickActionsProps {
  actions: string[];
}

export default function QuickActions({ actions }: QuickActionsProps) {
  const emit = defineEmits<{
    welcomed: [];
    subscribed: [count: number];
    chosen: [action: string, scope: string];
  }>();

  const query = ref("");
  const lastKey = ref("none");
  const scope = ref("mine");
  const subscriptions = ref(0);

  function clear(event: KeyboardEvent) {
    event.preventDefault();
    query.value = "";
  }

  function track(event: KeyboardEvent): boolean {
    lastKey.value = event.key;
    return event.key === "Enter";
  }

  function keyFor(action: string, event: KeyboardEvent): boolean {
    lastKey.value = `${action}: ${event.key}`;
    return false;
  }

  function choose(action: string, current: string) {
    emit("chosen", action, current);
  }

  return (
    <section class="quick-actions" aria-label="Quick actions">
      <label>
        Search
        <input
          name="query"
          onInput={(event) => (query.value = (event.currentTarget as HTMLInputElement).value)}
          onKeydown={(event) => {
            if (event.key === "Escape") clear(event);
          }}
        />
      </label>
      <p>Query: {query.value}</p>
      <label>
        Note
        <input name="note" onKeydown={(event) => track(event)} />
      </label>
      <label>
        Scope
        <select
          name="scope"
          onChange={(event) => (scope.value = (event.currentTarget as HTMLSelectElement).value)}
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
              <input name={action} onKeydown={(event) => keyFor(action, event)} />
            </label>
            <button type="button" onClick={() => choose(action, scope.value)}>
              {`Run ${action}`}
            </button>
          </li>
        ))}
      </ul>
      <p>Last key: {lastKey.value}</p>
      <form
        class="subscribe"
        aria-label="Subscribe"
        onSubmitOnce={(event) => {
          event.preventDefault();
          emit("welcomed");
        }}
        onSubmit={(event) => {
          event.preventDefault();
          subscriptions.value += 1;
          emit("subscribed", subscriptions.value);
        }}
      >
        <p>Subscriptions: {subscriptions.value}</p>
        <button type="submit">Subscribe</button>
      </form>
    </section>
  );
}
