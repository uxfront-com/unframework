<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Drawer.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shown = $state(true);
  let open = $state(true);
</script>

<section
  aria-label="Filters"
  class={className}
  {style}
  data-uf-54e3e959=""
  bind:this={ref}
  {...attributes}
>
  <button type="button" onclick={() => (shown = !shown)} data-uf-54e3e959="">Drawer</button
  ><button type="button" onclick={() => (open = !open)} data-uf-54e3e959="">Body</button
  >{#if shown}
    {#if open}
      <p in:enter={"fade"} out:leave={"fade"} class="body" data-uf-54e3e959="">Colour, size</p>
    {/if}
  {/if}
</section>
