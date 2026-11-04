<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { DEFAULT_SIZE, SIZES, SIZE_ORDER, type Size } from "./tokens";
  import type { ClassValue } from "svelte/elements";

  type Props = { class?: ClassValue; style?: string };

  let { class: className, style, ...attributes }: Props = $props();

  let size = $state.raw<Size>(DEFAULT_SIZE);

  function pick(next: Size) {
    size = next;
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<fieldset class={["size-picker", className]} {style} {...scopeAttributes(attributes)}>
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
