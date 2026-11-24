<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import "./Badge.uf.tsx.css";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "count" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    count: number;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let {
    label,
    count,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span class={["badge", className]} {style} data-uf-d9cef2e7="" bind:this={ref} {...attributes}>
  <span class="label" data-uf-d9cef2e7="">{label}</span
  ><span class="count" data-uf-d9cef2e7="">{count}</span>
</span>
