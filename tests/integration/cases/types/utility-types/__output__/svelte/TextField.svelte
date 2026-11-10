<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  import type { FieldOptions } from "./types";

  export type TextFieldProps = Required<Pick<FieldOptions, "name" | "label">> &
    Readonly<Partial<Omit<FieldOptions, "name" | "label">>>;
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = TextFieldProps & { class?: ClassValue; style?: string };

  let {
    name,
    label,
    placeholder,
    required,
    class: className,
    style,
    ...attributes
  }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<label
  class={className}
  {style}
  {...scopeAttributes(attributes)}
>{label}<input {name} {placeholder} {required} /></label>
