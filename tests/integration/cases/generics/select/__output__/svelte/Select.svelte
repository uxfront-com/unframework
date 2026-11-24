<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface SelectProps<T extends string> {
    label: string;
    options: readonly T[];
  }
</script>

<script lang="ts" generics="T extends string">
  import type { ClassValue, HTMLLabelAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLLabelAttributes,
    "label" | "options" | "value" | "children" | "class" | "style" | "ref"
  > &
    SelectProps<T> & {
      value: T;
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["label"] | null;
    };

  let {
    label,
    options,
    value = $bindable(),
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<label
  class={className}
  {style}
  bind:this={ref}
  {...attributes}
>{label} <select
  bind:value
>{#each options as option (option)}<option value={option}>{option}</option>{/each}</select></label>
