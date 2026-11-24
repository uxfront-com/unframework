<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";
  import { chip } from "virtual:fixture-engine";
  import "virtual:fixture-engine.css";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    tone?: "plain" | "accent";
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let {
    label,
    tone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span class={[chip(tone), className]} {style} bind:this={ref} {...attributes}>{label}</span>
