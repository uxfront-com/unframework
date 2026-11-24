<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import Mat from "./Mat.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "matted" | "children" | "class" | "style" | "ref"
  > & {
    matted?: boolean;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    matted = true,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  const Component = $derived(matted ? Mat : Frame);
</script>

<section class={className} {style} bind:this={ref} {...attributes}>
  <Frame>
    <p class="caption" data-uf-9dc516fd-s="">A quiet harbour</p>
  </Frame
  ><Frame>
    {#snippet label({ text })}
      <p class="caption" data-uf-9dc516fd-s="">{text}</p>
    {/snippet}
  </Frame
  ><Component>
    <p class="caption" data-uf-09929c4a-s="" data-uf-9dc516fd-s="">A matted print</p>
  </Component
  ><p class="caption">Outside the frame</p>
</section>
