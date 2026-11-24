<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Button from "./Button.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Toolbar.uf.tsx.css";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<div
  role="toolbar"
  aria-label="Actions"
  class={["toolbar", className]}
  {style}
  data-uf-a33d603f=""
  bind:this={ref}
  {...attributes}
>
  <Button text="Save" {...{ "data-uf-a33d603f": "" }}
  /><Button text="Cancel" {...{ "data-uf-a33d603f": "" }} />
</div>
