<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import SaveButton from "./SaveButton.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let pressed = $state(false);
</script>

<div class={["editor", className]} {style} bind:this={ref} {...attributes}>
  <p id="save-hint">Saves the draft.</p
  ><SaveButton
    title="Save"
    id="save"
    aria-describedby="save-hint"
    aria-pressed={pressed}
    data-testid="save-button"
    type="submit"
    class="primary"
  /><button type="button" onclick={() => (pressed = !pressed)}>Toggle</button>
</div>
