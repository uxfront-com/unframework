<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  import type { FieldOptions } from "./types";

  export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
    Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;
</script>

<script lang="ts">
  import type { ClassValue, HTMLLabelAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLLabelAttributes,
    "name" | "label" | "placeholder" | "required" | "children" | "class" | "style" | "ref"
  > &
    TextFieldProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["label"] | null;
    };

  let {
    name,
    label,
    placeholder,
    required,
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
>{label}<input {name} {placeholder} {required} /></label>
