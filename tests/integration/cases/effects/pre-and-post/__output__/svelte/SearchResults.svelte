<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onready?: (text: string) => void;
    onrendered?: (count: number) => void;
    onshown?: (text: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { onready, onrendered, onshown, class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["search-results", className]}
  aria-label="Search"
  {style}
  {...scopeAttributes(attributes)}
>
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
