<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { onMount, untrack } from "svelte";
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "onstep" | "children" | "class" | "style" | "ref"> & {
    onstep?: (text: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { onstep, class: className, style, ref = $bindable(null), onclick, ...attributes }: Props = $props();

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
    if (queryWatched && Object.is(value, previousQuery)) {return;}
    queryWatched = true;
    previousQuery = value;
    untrack(() => {
      cleanupQuery?.();
      const cleanups: Array<() => void> = [];
      cleanupQuery = () => {
        for (const cleanup of cleanups) {cleanup();}
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

<button
  type="button"
  onclick={(event) => {
    query += "a";
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>Type</button>
