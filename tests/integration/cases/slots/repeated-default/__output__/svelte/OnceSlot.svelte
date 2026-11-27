<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "text" | "children" | "class" | "style" | "ref"
  > & {
    label: string;
    text?: Snippet<[{ label: string }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let {
    label,
    text,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={["once-slot", className]}
  {style}
  bind:this={ref}
  {...attributes}
>{@render text?.({ label })}</span>
