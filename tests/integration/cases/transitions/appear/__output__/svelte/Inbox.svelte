<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Toast from "./Toast.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shown = $state(true);
</script>

<section aria-label="Inbox" class={className} {style} bind:this={ref} {...attributes}>
  <button type="button" onclick={() => (shown = !shown)}>{shown ? "Hide" : "Show"}</button
  >{#if shown}
    <Toast />
  {/if}
</section>
