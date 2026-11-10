<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" generics="T extends { value: string }">
  import type { Snippet } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    options: T[];
    option?: Snippet<[{ option: T }]>;
    class?: ClassValue;
    style?: string;
  };

  let { options, option: optionSnippet, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<ul class={className} {style} {...scopeAttributes(attributes)}>
  {#each options as option (option.value)}
    <li>{@render optionSnippet?.({ option })}</li>
  {/each}
</ul>
