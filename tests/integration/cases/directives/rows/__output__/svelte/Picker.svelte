<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["div"],
    "option" | "children" | "class" | "style" | "ref"
  > & {
    option?: Snippet<[{ option: { id: string; label: string } }]>;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let {
    option: optionSnippet,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let options = $state.raw([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);
</script>

<div class={["picker", className]} {style} bind:this={ref} {...attributes}>
  <ul aria-label="Options">
    {#each options as option (option.id)}
      <li>{@render optionSnippet?.({ option })}</li>
    {/each}
  </ul
  ><button type="button" onclick={() => (options = [...options].reverse())}>Reverse options</button
  ><button
    type="button"
    onclick={() => (options = options.filter((option) => option.id !== "y"))}
  >Remove option</button>
</div>
