<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface CalloutProps {
    heading: string;
    body: string;
  }
</script>

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["aside"],
    "heading" | "body" | "children" | "class" | "style" | "ref"
  > &
    CalloutProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["aside"] | null;
    };

  let {
    heading,
    body,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<aside
  class={["callout", className]}
  aria-label={heading}
  style={mergeStyle({ "--callout-accent": "#1f4d7a", "border-left": "4px solid var(--callout-accent)", padding: "8px 12px", color: "#1a1a1a" }, style)}
  bind:this={ref}
  {...attributes}
>
  <p style="margin: 0; font-weight: 700">{heading}</p
  ><p style="margin: 4px 0 0">{body}</p>
</aside>
