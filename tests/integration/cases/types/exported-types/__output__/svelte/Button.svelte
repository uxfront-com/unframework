<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export type ButtonTone = "primary" | "secondary";

  export type ButtonSize = "small" | "large";

  export interface ButtonProps {
    label: string;
    tone?: ButtonTone;
  }
</script>

<script lang="ts">
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLButtonAttributes,
    "label" | "tone" | "children" | "class" | "style" | "ref"
  > &
    ButtonProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["button"] | null;
    };

  let {
    label,
    tone = "primary",
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<button
  type="button"
  class={[`button button-${tone}`, className]}
  {style}
  bind:this={ref}
  {...attributes}
>{label}</button>
