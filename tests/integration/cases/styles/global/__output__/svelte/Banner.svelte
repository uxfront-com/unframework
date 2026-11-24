<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Hint from "./Hint.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Banner.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "tip" | "children" | "class" | "style" | "ref"> & {
    tip: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { tip, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div class={["banner", className]} {style} data-uf-e25060c2="" bind:this={ref} {...attributes}>
  <Hint text={tip} {...{ "data-uf-e25060c2": "" }} />
</div>
