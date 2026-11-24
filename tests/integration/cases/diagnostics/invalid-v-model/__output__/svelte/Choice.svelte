<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "picked" | "children" | "class" | "style" | "ref"> & {
    picked?: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let {
    picked = $bindable(""),
    class: className,
    style,
    ref = $bindable(null),
    onclick,
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  onclick={(event) => {
    picked = "yes";
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>Yes ({picked})</button>
