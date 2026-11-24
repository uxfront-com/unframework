<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface BadgeProps {
    label: string;
    tone?: string;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import { styleText } from "./_unframework/styleText";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    BadgeProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["span"] | null };

  let {
    label,
    tone,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<span
  class={["badge", className]}
  style={mergeStyle({}, [styleText(tone), style].join("; "))}
  bind:this={ref}
  {...attributes}
>{label}</span>
