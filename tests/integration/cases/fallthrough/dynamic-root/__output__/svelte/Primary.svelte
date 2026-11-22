<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    href?: string;
    disabled?: boolean;
    text: string;
    onpress?: () => void;
    class?: ClassValue;
    style?: string;
  };

  let { href, disabled, text, onpress, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<Base
  {href}
  {disabled}
  {text}
  class={["primary", className]}
  onpress={() => onpress?.()}
  {style}
  {...scopeAttributes(attributes)}
/>
