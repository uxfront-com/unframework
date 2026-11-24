<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["p"],
    "text" | "tone" | "children" | "class" | "style" | "ref"
  > & {
    text: string;
    tone: "info" | "quiet";
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["p"] | null;
  };

  let {
    text,
    tone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<p
  role="status"
  class={["notice", tone, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{text}</p>
