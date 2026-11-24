<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import { vMark } from "./vMark.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Banner.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let shown = $state(true);
</script>

<section
  aria-label="News"
  class={className}
  {style}
  data-uf-53025c4a=""
  bind:this={ref}
  {...attributes}
>
  <button type="button" onclick={() => (shown = false)} data-uf-53025c4a="">Dismiss</button
  >{#if shown}
    <p
      in:enter={"fade"}
      out:leave={"fade"}
      class="banner"
      {@attach vMark(() => "banner")}
      data-uf-53025c4a=""
    >New releases are out.</p>
  {/if}
</section>
