<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import { scopeAttributes } from "./_unframework/scopeAttributes";
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
