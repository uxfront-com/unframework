<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Accordion.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let open = $state(true);
</script>

<section
  aria-label="Shipping"
  class={className}
  {style}
  data-uf-357b6b1f=""
  bind:this={ref}
  {...attributes}
>
  <button
    type="button"
    aria-expanded={open}
    onclick={() => (open = !open)}
    data-uf-357b6b1f=""
  >Shipping</button
  >{#if open}
    <div in:enter={"outer"} out:leave={"outer"} class="panel" data-uf-357b6b1f="">
      <p class="note" data-uf-357b6b1f="">Ships in two days.</p>
    </div>
  {/if}
</section>
