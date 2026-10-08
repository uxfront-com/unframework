<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { on } from "svelte/events";

  export interface QuickActionsProps {
    actions: string[];
  }

  type Props = QuickActionsProps & {
    onwelcomed?: () => void;
    onsubscribed?: (count: number) => void;
    onchosen?: (action: string, scope: string) => void;
  };

  let { actions, onwelcomed, onsubscribed, onchosen }: Props = $props();

  let query = $state("");
  let lastKey = $state("none");
  let scope = $state("mine");
  let subscriptions = $state(0);

  function clear(event: KeyboardEvent) {
    event.preventDefault();
    query = "";
  }

  function track(event: KeyboardEvent): boolean {
    lastKey = event.key;
    return event.key === "Enter";
  }

  function keyFor(action: string, event: KeyboardEvent): boolean {
    lastKey = `${action}: ${event.key}`;
    return false;
  }

  function choose(action: string, current: string) {
    onchosen?.(action, current);
  }

  function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {
    let ran = false;
    return (event) => {
      if (ran) return;
      ran = true;
      handler(event);
    };
  }
</script>

<section class="quick-actions" aria-label="Quick actions">
  <label>Search<input
    name="query"
    oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
    onkeydown={(event) => {
      if (event.key === "Escape") clear(event);
    }}
  /></label
  ><p>Query: {query}</p
  ><label>Note<input name="note" onkeydown={(event) => track(event)} /></label
  ><label>Scope<select
    name="scope"
    onchange={(event) => (scope = (event.currentTarget as HTMLSelectElement).value)}
  ><option value="mine">Mine</option><option value="team">Team</option></select></label
  ><ul aria-label="Actions">
    {#each actions as action (action)}
      <li>
        <label>{`Shortcut for ${action}`}<input
          name={action}
          onkeydown={(event) => keyFor(action, event)}
        /></label
        ><button type="button" onclick={() => choose(action, scope)}>{`Run ${action}`}</button>
      </li>
    {/each}
  </ul
  ><p>Last key: {lastKey}</p
  ><form
    class="subscribe"
    aria-label="Subscribe"
    {@attach (node) => on(node, "submit", once((event) => {
      event.preventDefault();
      onwelcomed?.();
    }))}
    {@attach (node) => on(node, "submit", (event) => {
      event.preventDefault();
      subscriptions += 1;
      onsubscribed?.(subscriptions);
    })}
  >
    <p>Subscriptions: {subscriptions}</p
    ><button type="submit">Subscribe</button>
  </form>
</section>
