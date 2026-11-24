<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { class: className, style, ref = $bindable(null), onclick, ...attributes }: Props = $props();

  function charge() {
    throw new Error("The card was declined");
  }
</script>

<button
  type="button"
  onclick={(event) => {
    charge();
    onclick?.(event);
  }}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>Charge</button>
