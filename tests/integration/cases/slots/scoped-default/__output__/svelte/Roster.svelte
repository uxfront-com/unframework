<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Names from "./Names.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { names: string[]; class?: ClassValue; style?: string };

  let { names, class: className, style }: Props = $props();
</script>

<Names {names} class={className} {style}>
  {#snippet children({ item })}
    <b>{item}!</b>
  {/snippet}
</Names>
