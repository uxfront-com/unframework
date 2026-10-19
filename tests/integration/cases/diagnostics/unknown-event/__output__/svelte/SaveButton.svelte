<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { onsave?: () => void; class?: ClassValue; style?: string };

  let { onsave, class: className, style }: Props = $props();
</script>

<button type="button" onclick={() => onsave?.()} class={className} {style}>Save</button>
