<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";

  type Props = {
    onready?: (text: string) => void;
    onrendered?: (count: number) => void;
    onshown?: (text: string) => void;
  };

  let { onready, onrendered, onshown }: Props = $props();

  let status = $state("Loading");
  let query = $state("");
  let results = $state.raw<string[]>([]);
  let count = $state(0);
  let doubled = $state(0);
  let banner: HTMLParagraphElement | null = null;
  let list: HTMLUListElement | null = null;
  let total: HTMLOutputElement | null = null;

  let previousQuery = untrack(() => query);
  $effect.pre(() => {
    const value = query;
    if (Object.is(value, previousQuery)) return;
    previousQuery = value;
    untrack(() => {
      results = value === "" ? [] : [value, `${value} docs`];
    });
  });

  let previousQuery_1 = untrack(() => query);
  $effect(() => {
    if (Object.is(query, previousQuery_1)) return;
    previousQuery_1 = query;
    untrack(() => {
      onrendered?.(list?.childElementCount ?? -1);
    });
  });

  let previousCount = untrack(() => count);
  $effect.pre(() => {
    const value = count;
    if (Object.is(value, previousCount)) return;
    previousCount = value;
    untrack(() => {
      doubled = value * 2;
    });
  });

  onMount(async () => {
    status = "Ready";
    await tick();
    onready?.(banner?.textContent ?? "");
  });

  async function addOne() {
    count += 1;
    await tick();
    onshown?.(total?.textContent ?? "");
  }
</script>

<section class="search-results" aria-label="Search">
  <p bind:this={banner}>{status}</p
  ><label>Query<input
    name="query"
    oninput={(event) => (query = (event.currentTarget as HTMLInputElement).value)}
  /></label
  ><ul bind:this={list} aria-label="Results">
    {#each results as result (result)}
      <li>{result}</li>
    {/each}
  </ul
  ><output bind:this={total}>{doubled}</output
  ><button type="button" onclick={addOne}>Add one</button>
</section>
