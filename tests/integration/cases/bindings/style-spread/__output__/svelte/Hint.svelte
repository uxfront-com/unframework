<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  interface HintAttributes {
    id: string;
    style?: string;
  }

  export interface HintProps {
    text: string;
    attrs: HintAttributes;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import { styleText } from "./_unframework/styleText";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["small"],
    "text" | "attrs" | "children" | "class" | "style" | "ref"
  > &
    HintProps & { class?: ClassValue; style?: string; ref?: HTMLElementTagNameMap["small"] | null };

  let {
    text,
    attrs,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<small
  id={attrs.id}
  class={className}
  style={mergeStyle({}, [styleText(attrs.style), style].join("; "))}
  bind:this={ref}
  {...attributes}
>{text}</small>
