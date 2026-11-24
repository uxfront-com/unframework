<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Panel.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["aside"],
    "text" | "children" | "class" | "style" | "ref"
  > & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["aside"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<aside class={["panel", className]} {style} data-uf-48dda3f4="" bind:this={ref} {...attributes}>
  <p class="text" data-uf-48dda3f4="">{text}</p>
</aside>
