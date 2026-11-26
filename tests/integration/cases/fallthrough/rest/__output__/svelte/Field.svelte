<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { scopeAttributes } from "./_unframework/scopeAttributes";
  import type { ClassValue, HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "label" | "children" | "class" | "style" | "ref"> & {
    label: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["label"] | null;
  };

  let { label, class: className, style, ref = $bindable(null), ...rest }: Props = $props();

  /** What the consumer passes, but the scope attributes the root keeps. */
  function restAttributes(props: object): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(props).filter(([name]) => !name.startsWith("data-uf-")),
    );
  }
</script>

<label
  class="field"
  bind:this={ref}
  {...scopeAttributes(rest)}
>{label} <input name={label.toLowerCase()} class={className} {style} {...restAttributes(rest)} /></label>
