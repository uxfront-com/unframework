<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" generics="T extends { value: string }">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["ul"],
    "options" | "option" | "children" | "class" | "style" | "ref"
  > & {
    options: T[];
    option?: Snippet<[{ option: T }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["ul"] | null;
  };

  let {
    options,
    option: optionSnippet,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<ul class={className} {style} bind:this={ref} {...attributes}>
  {#each options as option (option.value)}
    <li>{@render optionSnippet?.({ option })}</li>
  {/each}
</ul>
