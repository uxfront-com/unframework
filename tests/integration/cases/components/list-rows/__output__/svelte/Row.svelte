<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; done: boolean; class?: ClassValue; style?: string };

  let { name, done, class: className, style }: Props = $props();
</script>

<div
  role="listitem"
  class={["row", { done }, className]}
  {style}
>{name}{done ? " (done)" : ""}</div>
