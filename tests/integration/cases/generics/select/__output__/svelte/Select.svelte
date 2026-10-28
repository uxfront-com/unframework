<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface SelectProps<T extends string> {
    label: string;
    options: readonly T[];
  }

  type Props = SelectProps<T> & { value: T; class?: ClassValue; style?: string };

  let {
    label,
    options,
    value = $bindable(),
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
>{label} <select
  bind:value
>{#each options as option (option)}<option value={option}>{option}</option>{/each}</select></label>
