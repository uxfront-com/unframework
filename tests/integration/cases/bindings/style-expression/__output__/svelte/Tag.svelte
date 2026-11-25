<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface TagProps {
    label: string;
    tone?: string;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["em"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    TagProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["em"] | null };

  let {
    label,
    tone: _tone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<em
  class={["tag", className]}
  style={mergeStyle({ color: "rgb(120, 30, 30)", padding: "1px 4px" }, style)}
  bind:this={ref}
  {...attributes}
>{label}</em>
