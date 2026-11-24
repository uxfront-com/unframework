<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useToggle } from "./useToggle.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["section"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  const toggle = useToggle(false);
</script>

<section
  class={["disclosure", className]}
  aria-label="Shipping"
  {style}
  bind:this={ref}
  {...attributes}
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
