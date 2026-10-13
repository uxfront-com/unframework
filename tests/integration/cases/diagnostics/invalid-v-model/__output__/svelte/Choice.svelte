<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { picked?: string; class?: ClassValue; style?: string };

  let { picked = $bindable(""), class: className, style }: Props = $props();
</script>

<button
  type="button"
  onclick={() => (picked = "yes")}
  class={className}
  {style}
>Yes ({picked})</button>
