<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { name: string; class?: ClassValue; style?: string };

  let { name, class: className, style }: Props = $props();
</script>

<span class={["tag", className]} {style} data-uf-ef5e671c="">{name}</span>
