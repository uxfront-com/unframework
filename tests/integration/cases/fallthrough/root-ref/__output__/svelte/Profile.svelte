<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Bio from "./Bio.svelte";
  import NameField from "./NameField.svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<HTMLFormAttributes, "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let name = $state<HTMLInputElement | null>(null);
  let bio = $state<HTMLInputElement | null>(null);
</script>

<form aria-label="Profile" class={className} {style} bind:this={ref} {...attributes}>
  <NameField bind:ref={name} label="Name"
  /><button type="button" onclick={() => name?.focus()}>Edit name</button
  ><Bio bind:ref={bio} label="Bio"
  /><button type="button" onclick={() => bio?.focus()}>Edit bio</button>
</form>
