<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { mergeStyle } from "./_unframework/mergeStyle";
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

  function press(event: MouseEvent) {
    event.preventDefault();
    onpress?.();
  }
</script>

<svelte:element
  this={href ? "a" : "button"}
  href={(href ? "a" : "button") === "a" ? href : undefined}
  disabled={(href ? "a" : "button") === "button" ? disabled : undefined}
  class={["base", className]}
  onclick={press}
  style={mergeStyle({ padding: "4px 8px" }, style)}
  {...scopeAttributes(attributes)}
>{text}</svelte:element>
