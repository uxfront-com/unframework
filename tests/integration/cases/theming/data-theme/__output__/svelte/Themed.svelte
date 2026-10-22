<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import "virtual:styleframe.css";
  import type { ClassValue } from "svelte/elements";

  type Props = { text: string; dark?: boolean; class?: ClassValue; style?: string };

  let { text, dark = false, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  data-theme={dark ? "dark" : "light"}
  class={["_padding:md _background-color:surface _color:text", className]}
  {style}
  {...scopeAttributes(attributes)}
>{text}</section>
