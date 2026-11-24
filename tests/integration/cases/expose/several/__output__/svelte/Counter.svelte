<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, HTMLOutputAttributes } from "svelte/elements";

  type Props = Omit<HTMLOutputAttributes, "start" | "children" | "class" | "style"> & {
    start: number;
    class?: ClassValue;
    style?: string;
  };

  let { start, class: className, style, ...attributes }: Props = $props();

  let count = $state(untrack(() => start));

  export function increment() {
    count++;
  }

  export const reset = () => {
    count = start;
  };
</script>

<output class={["count", className]} {style} {...attributes}>{count}</output>
