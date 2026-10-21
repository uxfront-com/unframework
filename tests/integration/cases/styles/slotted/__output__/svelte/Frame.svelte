<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { children?: Snippet; class?: ClassValue; style?: string };

  let { children, class: className, style }: Props = $props();
</script>

<figure class={["frame", className]} {style} data-uf-9dc516fd="">{@render children?.()}</figure>
