<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useToggle } from "./useToggle.svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  const toggle = useToggle(false);

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["disclosure", className]}
  aria-label="Shipping"
  {style}
  {...scopeAttributes(attributes)}
>
  <button
    type="button"
    aria-expanded={toggle.on}
    onclick={() => toggle.toggle()}
  >Shipping details</button
  >{#if toggle.on}
    <div class="panel">
      <p>Orders ship within two days.</p
      ><button type="button" onclick={() => toggle.close()}>Close</button>
    </div>
  {/if}
</section>
