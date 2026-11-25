<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    label: string;
    colour?: string;
    weight?: number;
    indent?: string;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "colour" | "weight" | "indent" | "children" | "class" | "style" | "ref"
  > &
    TagProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    label,
    colour,
    weight,
    indent,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={["tag", className]}
  style={mergeStyle({ display: "inline-block", padding: "2px 8px", "border-style": "solid", "border-width": "1px", "border-color": colour ?? "#5a5a5a", color: colour, "font-weight": weight, "margin-left": indent }, style)}
  bind:this={ref}
  {...attributes}
>{label}</span>
