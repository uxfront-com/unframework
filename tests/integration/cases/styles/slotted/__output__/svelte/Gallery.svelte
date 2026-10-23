<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Frame from "./Frame.svelte";
  import Mat from "./Mat.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { matted?: boolean; class?: ClassValue; style?: string };

  let { matted = true, class: className, style, ...attributes }: Props = $props();

  const Component = $derived(matted ? Mat : Frame);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={className} {style} {...scopeAttributes(attributes)}>
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
