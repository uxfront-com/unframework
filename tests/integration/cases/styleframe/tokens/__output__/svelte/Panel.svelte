<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "virtual:styleframe.css";
  import "./Panel.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "text" | "children" | "class" | "style" | "ref"
  > & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<section class={["panel", className]} {style} data-uf-b6be1fd3="" bind:this={ref} {...attributes}>
  <p class="body" data-uf-b6be1fd3="">{text}</p>
</section>
