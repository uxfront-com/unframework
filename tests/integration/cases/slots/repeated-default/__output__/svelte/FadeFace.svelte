<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { enter, leave } from "./_unframework/transition";
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./FadeFace.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "bold" | "children" | "class" | "style" | "ref"> & {
    bold: boolean;
    children?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    bold,
    children,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<div class={["fade-face", className]} {style} data-uf-c9301a2a="" bind:this={ref} {...attributes}>
  {#if bold}
    <b
      in:enter={"face"}
      out:leave={"face"}
      class="face"
      data-uf-c9301a2a=""
    >{@render children?.()}</b>
  {:else}
    <i
      in:enter={"face"}
      out:leave={"face"}
      class="face"
      data-uf-c9301a2a=""
    >{@render children?.()}</i>
  {/if}
</div>
