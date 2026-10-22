<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Amber from "./Amber.svelte";
  import Blue from "./Blue.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  const items = [
    { label: "Warm", warm: true },
    { label: "Cool", warm: false },
  ];

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section class={className} {style} {...scopeAttributes(attributes)}>
  <Blue>
    <p class="caption" data-uf-721c504a-s="">In blue</p>
  </Blue
  ><Amber>
    <p class="caption" data-uf-c97301b3-s="">In amber</p>
  </Amber
  >{#each items as item (item.label)}
    <div>
      {#if item.warm}
        <Amber>
          <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{item.label}</p>
        </Amber>
      {:else}
        <Blue>
          <p class="caption" data-uf-c97301b3-s="" data-uf-721c504a-s="">{item.label}</p>
        </Blue>
      {/if}
    </div>
  {/each}
</section>
