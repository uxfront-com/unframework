<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Panel.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(false);
</script>

<section
  class={["panel", className]}
  aria-label="Delivery"
  {style}
  data-uf-eab7eeb4=""
  bind:this={ref}
  {...attributes}
>
  <button
    type="button"
    aria-expanded={open}
    onclick={() => (open = !open)}
    data-uf-eab7eeb4=""
  >Details</button
  >{#if open}
    <p in:enter={"v"} out:leave={"v"} class="details" data-uf-eab7eeb4="">Ships in two days.</p>
  {/if}
</section>
