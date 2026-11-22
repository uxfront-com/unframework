<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Base from "./Base.svelte";
  import type { ClassValue, HTMLButtonAttributes } from "svelte/elements";

  type Props = Omit<HTMLButtonAttributes, "text" | "children" | "class" | "style" | "ref"> & {
    text: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["button"] | null;
  };

  let { text, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<Base {text} class={["primary", className]} {style} bind:ref {...attributes} />
