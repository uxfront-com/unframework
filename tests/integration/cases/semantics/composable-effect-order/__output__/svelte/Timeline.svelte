<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useTracked } from "./useTracked.svelte";
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["timeline", className]}
  aria-label="Timeline"
  {style}
  {...scopeAttributes(attributes)}
>
  <p role="status">Count: {tracked.count}</p
  ><button type="button" onclick={() => tracked.increment()}>Increment</button
  ><ol>
    {#each entries as entry, index (index)}
      <li>{entry}</li>
    {/each}
  </ol>
</section>
