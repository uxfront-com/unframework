<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTracked } from "./useTracked.svelte";
  import { onMount, untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let entries = $state.raw<string[]>([]);

  function record(entry: string) {
    entries = [...entries, entry];
  }

  onMount(() => {
    record("caller mounted first");
  });

  const tracked = useTracked((entry) => record(entry));

  let previousCount = untrack(() => tracked.count);
  $effect.pre(() => {
    if (Object.is(tracked.count, previousCount)) return;
    previousCount = tracked.count;
    untrack(() => {
      record("caller watcher");
    });
  });

  onMount(() => {
    record("caller mounted last");
  });
</script>

<section
  class={["timeline", className]}
  aria-label="Timeline"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">Count: {tracked.count}</p
  ><button type="button" onclick={() => tracked.increment()}>Increment</button
  ><ol>
    {#each entries as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
