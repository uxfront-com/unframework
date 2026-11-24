<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
  import type { ClassValue, HTMLFieldsetAttributes } from "svelte/elements";

  type Props = Omit<HTMLFieldsetAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["fieldset"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let size = $state.raw<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    size = next;
  }
</script>

<fieldset class={["size-picker", className]} {style} bind:this={ref} {...attributes}>
  <legend>Size</legend
  ><p role="status">Picked: {SIZES[size]}</p
  ><ul>
    {#each SIZE_ORDER as each (each)}
      <li>
        <button
          type="button"
          aria-pressed={size === each}
          onclick={() => pick(each)}
        >{SIZES[each]}</button>
      </li>
    {/each}
  </ul>
</fieldset>
