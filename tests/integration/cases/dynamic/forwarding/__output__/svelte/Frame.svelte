<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Card from "./Card.svelte";
  import Panel from "./Panel.svelte";
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "label" | "wide" | "title" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    wide: boolean;
    title?: Snippet;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    label,
    wide,
    title,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const Component = $derived(wide ? Panel : Card);
</script>

<section class={["frame", className]} aria-label={label} {style} bind:this={ref} {...attributes}>
  <Component {title} />
</section>
