<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = { title: string; open?: boolean; class?: ClassValue; style?: string };

  let { title, open = $bindable(false), class: className, style }: Props = $props();
</script>

<div class={["disclosure", className]} {style}>
  <button type="button" aria-expanded={open} onclick={() => (open = !open)}>{title}</button
  >{#if open}
    <p>Details of {title}</p>
  {/if}
</div>
