<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Panel from "./Panel.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["main"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["main"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shown = $state(true);
</script>

<main class={["board", className]} {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (shown = false)}>Remove panel</button
  >{#if shown}
    <Panel />
  {/if}
</main>
