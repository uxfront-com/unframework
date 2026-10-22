<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";
  import "./Frame.uf.tsx.css";

  type Props = {
    children?: Snippet;
    label?: Snippet<[{ text: string }]>;
    class?: ClassValue;
    style?: string;
  };

  let { children, label, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<figure
  class={["frame", className]}
  {style}
  data-uf-9dc516fd=""
  {...scopeAttributes(attributes)}
>{@render children?.()}{@render label?.({ text: "Harbour at dusk" })}</figure>
