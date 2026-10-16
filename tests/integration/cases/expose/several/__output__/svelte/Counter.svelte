<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { start: number; class?: ClassValue; style?: string };

  let { start, class: className, style }: Props = $props();

  let count = $state(untrack(() => start));

  export function increment() {
    count++;
  }

  export const reset = () => {
    count = start;
  };
</script>

<output class={["count", className]} {style}>{count}</output>
