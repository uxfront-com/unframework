<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    onstep?: (text: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { onstep, class: className, style }: Props = $props();

  let query = $state("");

  $effect(() => {
    const value = query;
    return () => onstep?.(`effect cleanup ${value}`);
  });

  let previousQuery = untrack(() => query);
  let queryWatched = false;
  let cleanupQuery: (() => void) | undefined;
  $effect.pre(() => {
    const value = query;
    if (queryWatched && Object.is(value, previousQuery)) return;
    queryWatched = true;
    previousQuery = value;
    untrack(() => {
      cleanupQuery?.();
      const cleanups: (() => void)[] = [];
      cleanupQuery = () => {
        for (const cleanup of cleanups) cleanup();
      };
      const onCleanup = (cleanup: () => void) => {
        cleanups.push(cleanup);
      };
      onCleanup(() => onstep?.(`watch cleanup ${value}`));
    });
  });
  onMount(() => () => cleanupQuery?.());

  onMount(() => () => {
    onstep?.("unmounted");
  });

  onMount(() => () => {
    onstep?.("closed");
  });
</script>

<button type="button" onclick={() => (query += "a")} class={className} {style}>Type</button>
