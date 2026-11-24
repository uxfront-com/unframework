<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ButtonProps } from "./types";
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLButtonAttributes,
    "disabled" | "label" | "id" | "children" | "class" | "style" | "ref"
  > &
    ButtonProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["button"] | null;
    };

  let {
    id,
    label,
    disabled = false,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<button
  {id}
  type="button"
  {disabled}
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</button>
