<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { loadUser } from "./api";
  import { onMount, untrack } from "svelte";
  import type { ClassValue, HTMLFormAttributes } from "svelte/elements";

  type Props = Omit<
    HTMLFormAttributes,
    "id" | "onready" | "children" | "class" | "style" | "ref"
  > & {
    id: string;
    onready?: (name: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["form"] | null;
  };

  let {
    id,
    onready,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let input: HTMLInputElement | null = null;

  onMount(() => {
    input?.focus();
    onready?.(user.name);
  });

  const user = await untrack(() => loadUser(id));
</script>

<form class={["note", className]} aria-label="Note" {style} bind:this={ref} {...attributes}>
  <label>Note for {user.name} <input bind:this={input} type="text" /></label>
</form>
